declare function importScripts(...urls: string[]): void
declare function cheerpjInit(options?: {
  version?: number
  status?: 'splash' | 'none' | 'default'
  natives?: Record<string, (...args: unknown[]) => unknown>
}): Promise<void>
declare function cheerpjRunMain(className: string, classPath: string, ...args: string[]): Promise<number>
declare function cheerpOSAddStringFile(path: string, content: Uint8Array): void

const CHEERPJ_LOADER_URL = 'https://cjrtnc.leaningtech.com/4.3/loader.js'
const COMPILER_URL = 'https://javafiddle.leaningtech.com/tools.jar'
const COMPILER_CLASSPATH = '/str/tools.jar'
const RUNTIME_CLASSES = '/files'
const RUNTIME_SOURCE_PATH = '/str/Runner.java'
const MAX_PROJECT_FILES = 50
const MAX_PROJECT_BYTES = 2 * 1024 * 1024
const MAX_OUTPUT_BYTES = 256 * 1024

const encoder = new TextEncoder()
const inputBridges = new Map<string, ReturnType<typeof createStdinBridge>>()

type JavaProjectFile = {
  path: string
  content: string
  language: string
}

type RunRequest = {
  id: string
  type: 'run'
  code: string
  entryPath: string
  files: JavaProjectFile[]
  timeoutMs: number
}

type StdinRequest = {
  id: string
  type: 'stdin'
  value: string
}

type AbortRequest = {
  id: string
  type: 'abort'
}

type RunnerRequest = RunRequest | StdinRequest | AbortRequest

type ActiveRun = {
  id: string
  stdout: string[]
  stderr: string[]
  outputBytes: number
  outputTruncated: boolean
  exitCode: number | null
}

let activeRun: ActiveRun | null = null
let runtimePromise: Promise<void> | null = null

function postRunnerMessage(message: Record<string, unknown>) {
  self.postMessage(message)
}

function createStdinBridge(onRequest: () => void) {
  let pending: { resolve: (value: string) => void; reject: (reason: Error) => void } | null = null

  return {
    read() {
      if (pending) return Promise.reject(new Error('Program input is already pending.'))
      onRequest()
      return new Promise<string>((resolve, reject) => {
        pending = { resolve, reject }
      })
    },
    write(value: string) {
      const request = pending
      pending = null
      request?.resolve(value)
    },
    abort(reason = new Error('Execution stopped.')) {
      const request = pending
      pending = null
      request?.reject(reason)
    },
  }
}

const RUNTIME_SOURCE = String.raw`package dev.hafacode.runtime;

import java.io.InputStream;
import java.io.OutputStream;
import java.io.PrintStream;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public final class Runner {
  private Runner() {}

  private static native void emit(String stream, String text);
  private static native String readLine();
  private static native void reportResult(int exitCode);

  private static final class BrowserOutputStream extends OutputStream {
    private final String stream;

    BrowserOutputStream(String stream) {
      this.stream = stream;
    }

    @Override
    public void write(int value) {
      byte[] singleByte = new byte[] { (byte) value };
      write(singleByte, 0, 1);
    }

    @Override
    public void write(byte[] bytes, int offset, int length) {
      if (length > 0) {
        emit(stream, new String(bytes, offset, length, StandardCharsets.UTF_8));
      }
    }
  }

  private static final class BrowserInputStream extends InputStream {
    private byte[] buffer = new byte[0];
    private int offset = 0;

    @Override
    public int read() {
      if (offset >= buffer.length) {
        String line = readLine();
        if (line == null) return -1;
        buffer = (line + "\n").getBytes(StandardCharsets.UTF_8);
        offset = 0;
      }
      return buffer[offset++] & 0xff;
    }

    @Override
    public int read(byte[] target, int targetOffset, int length) {
      if (length == 0) return 0;
      if (offset >= buffer.length) {
        String line = readLine();
        if (line == null) return -1;
        buffer = (line + "\n").getBytes(StandardCharsets.UTF_8);
        offset = 0;
      }

      int count = Math.min(length, buffer.length - offset);
      System.arraycopy(buffer, offset, target, targetOffset, count);
      offset += count;
      return count;
    }
  }

  public static void main(String[] args) {
    System.setOut(new PrintStream(new BrowserOutputStream("stdout"), true));
    System.setErr(new PrintStream(new BrowserOutputStream("stderr"), true));
    System.setIn(new BrowserInputStream());

    if (args.length < 3) {
      System.err.println("Java runner configuration is incomplete.");
      reportResult(1);
      return;
    }

    String outputDirectory = args[0];
    String mainClassName = args[1];
    java.io.File outputDirectoryFile = new java.io.File(outputDirectory);
    if (!outputDirectoryFile.exists() && !outputDirectoryFile.mkdirs()) {
      System.err.println("Java could not prepare its browser output directory.");
      reportResult(1);
      return;
    }
    List<String> compilerArguments = new ArrayList<>();
    compilerArguments.addAll(Arrays.asList(
      "-encoding", "UTF-8",
      "-proc:none",
      "-classpath", outputDirectory,
      "-d", outputDirectory,
      "-Xlint:all"
    ));
    compilerArguments.addAll(Arrays.asList(args).subList(2, args.length));

    try {
      Class<?> compiler = Class.forName("com.sun.tools.javac.Main");
      Method compile = compiler.getMethod("compile", String[].class);
      int compileExitCode = (Integer) compile.invoke(null, (Object) compilerArguments.toArray(new String[0]));
      if (compileExitCode != 0) {
        reportResult(compileExitCode);
        return;
      }

      java.net.URL outputUrl = outputDirectoryFile.toURI().toURL();
      try (java.net.URLClassLoader projectClassLoader = new java.net.URLClassLoader(
          new java.net.URL[] { outputUrl }, Runner.class.getClassLoader())) {
        Class<?> mainClass = Class.forName(mainClassName, true, projectClassLoader);
        Method main = mainClass.getMethod("main", String[].class);
        main.invoke(null, (Object) new String[0]);
      }
      reportResult(0);
    } catch (InvocationTargetException error) {
      Throwable cause = error.getCause() == null ? error : error.getCause();
      cause.printStackTrace(System.err);
      reportResult(1);
    } catch (Throwable error) {
      error.printStackTrace(System.err);
      reportResult(1);
    }
  }
}
`

function safeProjectPath(path: string) {
  const normalized = path.replace(/\\/g, '/')
  const segments = normalized.split('/')
  if (segments.some((segment) => !segment || segment === '.' || segment === '..' || segment.startsWith('.'))) {
    throw new Error(`Unsupported Java file path: ${path}`)
  }
  return segments.join('/')
}

function appendOutput(stream: 'stdout' | 'stderr', value: unknown) {
  if (!activeRun) return
  const text = String(value)
  const nextBytes = encoder.encode(text).byteLength

  if (activeRun.outputBytes + nextBytes > MAX_OUTPUT_BYTES) {
    if (!activeRun.outputTruncated) {
      activeRun.outputTruncated = true
      const message = `\nOutput stopped after ${MAX_OUTPUT_BYTES / 1024} KB.\n`
      activeRun.stderr.push(message)
      postRunnerMessage({ id: activeRun.id, type: 'output', stream: 'stderr', text: message })
    }
    return
  }

  activeRun.outputBytes += nextBytes
  activeRun[stream].push(text)
  postRunnerMessage({ id: activeRun.id, type: 'output', stream, text })
}

function initializeRuntime() {
  runtimePromise ??= (async () => {
    importScripts(CHEERPJ_LOADER_URL)
    await cheerpjInit({
      version: 8,
      status: 'none',
      natives: {
        Java_dev_hafacode_runtime_Runner_emit(_library: unknown, stream: unknown, text: unknown) {
          appendOutput(String(stream) === 'stderr' ? 'stderr' : 'stdout', text)
        },
        async Java_dev_hafacode_runtime_Runner_readLine() {
          if (!activeRun) return null
          return inputBridges.get(activeRun.id)?.read() ?? null
        },
        Java_dev_hafacode_runtime_Runner_reportResult(_library: unknown, exitCode: unknown) {
          if (activeRun) activeRun.exitCode = Number(exitCode)
        },
      },
    })

    const compilerResponse = await fetch(COMPILER_URL)
    if (!compilerResponse.ok) {
      throw new Error(`The Java compiler could not be downloaded (${compilerResponse.status}).`)
    }
    cheerpOSAddStringFile(COMPILER_CLASSPATH, new Uint8Array(await compilerResponse.arrayBuffer()))
    cheerpOSAddStringFile(RUNTIME_SOURCE_PATH, encoder.encode(RUNTIME_SOURCE))
    const compilerMessages: string[] = []
    const originalConsoleLog = console.log
    const originalConsoleError = console.error
    console.log = (...values: unknown[]) => {
      compilerMessages.push(values.map(String).join(' '))
      originalConsoleLog(...values)
    }
    console.error = (...values: unknown[]) => {
      compilerMessages.push(values.map(String).join(' '))
      originalConsoleError(...values)
    }

    try {
      const compileExitCode = await cheerpjRunMain(
        'com.sun.tools.javac.Main',
        `${COMPILER_CLASSPATH}:${RUNTIME_CLASSES}/`,
        '-encoding', 'UTF-8',
        '-proc:none',
        '-d', RUNTIME_CLASSES,
        RUNTIME_SOURCE_PATH,
      )
      if (compileExitCode !== 0) {
        const details = compilerMessages.filter(Boolean).join('\n').trim()
        throw new Error(`The Java browser bridge could not be prepared.${details ? `\n${details}` : ''}`)
      }
    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
    }
  })().catch((error) => {
    runtimePromise = null
    throw error
  })

  return runtimePromise
}

function validateProject(request: RunRequest) {
  if (request.files.length > MAX_PROJECT_FILES) throw new Error(`Java projects support up to ${MAX_PROJECT_FILES} files.`)
  const totalBytes = request.files.reduce((total, file) => total + encoder.encode(file.content).byteLength, 0)
  if (totalBytes > MAX_PROJECT_BYTES) throw new Error('Java projects support up to 2 MB of source code.')

  const entryPath = safeProjectPath(request.entryPath)
  const javaFiles = request.files.filter((file) => file.language === 'java' || file.path.toLowerCase().endsWith('.java'))
  if (!javaFiles.some((file) => safeProjectPath(file.path) === entryPath)) {
    throw new Error(`Java entry file not found: ${entryPath}`)
  }
  if (!entryPath.toLowerCase().endsWith('.java')) throw new Error('The Java entry file must end in .java.')

  for (const file of javaFiles) {
    if (/^\s*package\s+[\w.]+\s*;/m.test(file.content)) {
      throw new Error('Java packages are not supported yet. Keep Main.java and helper classes in the default package.')
    }
  }

  const basenames = javaFiles.map((file) => safeProjectPath(file.path).split('/').pop() ?? '')
  if (new Set(basenames).size !== basenames.length) {
    throw new Error('Java files must have unique filenames while packages are disabled.')
  }

  return { entryPath, javaFiles }
}

async function runJava(request: RunRequest) {
  const { entryPath, javaFiles } = validateProject(request)
  await initializeRuntime()

  const runToken = request.id.replace(/[^a-zA-Z0-9]/g, '')
  const outputDirectory = `/files/runs/${runToken}`
  const sourcePaths = javaFiles.map((file) => {
    const path = safeProjectPath(file.path)
    const sourcePath = `/str/${path.split('/').pop()}`
    cheerpOSAddStringFile(sourcePath, encoder.encode(path === entryPath ? request.code : file.content))
    return sourcePath
  })
  const mainClassName = entryPath.split('/').pop()?.replace(/\.java$/i, '') ?? 'Main'
  const inputBridge = createStdinBridge(() => postRunnerMessage({ id: request.id, type: 'input_request' }))
  inputBridges.set(request.id, inputBridge)
  activeRun = {
    id: request.id,
    stdout: [],
    stderr: [],
    outputBytes: 0,
    outputTruncated: false,
    exitCode: null,
  }

  postRunnerMessage({ id: request.id, type: 'started' })

  try {
    const classPath = `${COMPILER_CLASSPATH}:${RUNTIME_CLASSES}:${outputDirectory}`
    const cheerpjExitCode = await cheerpjRunMain(
      'dev.hafacode.runtime.Runner',
      classPath,
      outputDirectory,
      mainClassName,
      ...sourcePaths,
    )
    return {
      stdout: activeRun.stdout.join(''),
      stderr: activeRun.stderr.join(''),
      exitCode: activeRun.exitCode ?? cheerpjExitCode,
    }
  } finally {
    inputBridge.abort()
    inputBridges.delete(request.id)
    activeRun = null
  }
}

self.onmessage = (event: MessageEvent<RunnerRequest>) => {
  const request = event.data
  if (request.type === 'stdin') {
    inputBridges.get(request.id)?.write(request.value)
    return
  }

  if (request.type === 'abort') {
    inputBridges.get(request.id)?.abort()
    return
  }

  const startedAt = performance.now()
  runJava(request)
    .then(({ stdout, stderr, exitCode }) => {
      postRunnerMessage({
        id: request.id,
        type: 'result',
        stdout,
        stderr,
        exitCode,
        durationMs: Math.round(performance.now() - startedAt),
      })
    })
    .catch((error) => {
      postRunnerMessage({
        id: request.id,
        type: 'result',
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: 1,
        durationMs: Math.round(performance.now() - startedAt),
      })
    })
}
