# Deterministic records for Playwright. This file is loaded only by the guarded e2e:reset task.
Project.destroy_all
OrganizationInvitation.delete_all
OrganizationMembership.delete_all
AuditEvent.delete_all
ApiRateLimit.delete_all
Organization.destroy_all
User.destroy_all

teacher = User.create!(
  id: 91_001,
  clerk_id: "e2e-teacher",
  email: "teacher@example.test",
  first_name: "Tala",
  last_name: "Teacher",
  role: :student
)
student = User.create!(
  id: 91_002,
  clerk_id: "e2e-student",
  email: "student@example.test",
  first_name: "Saina",
  last_name: "Student",
  role: :student
)
classmate = User.create!(
  id: 91_003,
  clerk_id: "e2e-classmate",
  email: "classmate@example.test",
  first_name: "Kiko",
  last_name: "Classmate",
  role: :student
)
invitee = User.create!(
  id: 91_004,
  clerk_id: "e2e-invitee",
  email: "invitee@example.test",
  first_name: "Nina",
  last_name: "Invitee",
  role: :student
)
admin = User.create!(
  id: 91_005,
  clerk_id: "e2e-admin",
  email: "admin@example.test",
  first_name: "Ana",
  last_name: "Admin",
  role: :admin
)
instructor = User.create!(
  id: 91_006,
  clerk_id: "e2e-instructor",
  email: "instructor@example.test",
  first_name: "Isa",
  last_name: "Instructor",
  role: :student
)
dual_student = User.create!(
  id: 91_007,
  clerk_id: "e2e-dual-student",
  email: "dual@example.test",
  first_name: "Dua",
  last_name: "Student",
  role: :student
)
outsider = User.create!(
  id: 91_008,
  clerk_id: "e2e-outsider",
  email: "outsider@example.test",
  first_name: "Osi",
  last_name: "Outsider",
  role: :student
)

classroom = Organization.create!(
  id: 92_001,
  name: "FDMS Web Development",
  slug: "fdms-web-development",
  school_year: "2026–2027",
  created_by: teacher
)
OrganizationMembership.create!(id: 92_101, organization: classroom, user: teacher, role: :owner)
OrganizationMembership.create!(id: 92_102, organization: classroom, user: student, role: :student)
OrganizationMembership.create!(id: 92_103, organization: classroom, user: classmate, role: :student)
OrganizationMembership.create!(id: 92_104, organization: classroom, user: instructor, role: :instructor)
OrganizationMembership.create!(id: 92_105, organization: classroom, user: dual_student, role: :student)

second_classroom = Organization.create!(
  id: 92_002,
  name: "FDMS Programming Foundations",
  slug: "fdms-programming-foundations",
  school_year: "2026–2027",
  created_by: teacher
)
OrganizationMembership.create!(id: 92_201, organization: second_classroom, user: teacher, role: :owner)
OrganizationMembership.create!(id: 92_202, organization: second_classroom, user: dual_student, role: :student)

private_project = Project.new(
  id: 93_001,
  user: student,
  organization: classroom,
  title: "Student Private Lab",
  kind: "javascript",
  visibility: "private",
  entry_path: "main.js"
)
private_project.project_files.build(
  path: "main.js",
  language: "javascript",
  content: "const greeting = 'Håfa adai';\nconsole.log(greeting);",
  position: 0
)
private_project.save!

class_project = Project.new(
  id: 93_002,
  user: student,
  organization: classroom,
  title: "Class Gallery",
  kind: "web",
  visibility: "organization",
  entry_path: "index.html"
)
class_project.project_files.build(
  path: "index.html",
  language: "html",
  content: "<h1>Our class gallery</h1>",
  position: 0
)
class_project.save!

classmate_project = Project.new(
  id: 93_003,
  user: classmate,
  organization: classroom,
  title: "Classmate Scratchpad",
  kind: "python",
  visibility: "private",
  entry_path: "main.py"
)
classmate_project.project_files.build(
  path: "main.py",
  language: "python",
  content: "print('practice')",
  position: 0
)
classmate_project.save!

ProjectComment.create!(
  id: 94_001,
  project: private_project,
  user: teacher,
  body: "Explain why const is a good choice here.",
  file_path: "main.js",
  line_number: 1
)

OrganizationInvitation.create!(
  id: 95_001,
  organization: classroom,
  invited_by: teacher,
  email: invitee.email,
  role: :student,
  token: "e2e-classroom-invite",
  delivery_status: "pending",
  expires_at: 7.days.from_now
)
OrganizationInvitation.create!(
  id: 95_002,
  organization: classroom,
  invited_by: teacher,
  email: outsider.email,
  role: :student,
  token: "e2e-expired-invite",
  delivery_status: "pending",
  expires_at: 1.day.ago
)

puts "Loaded isolated classroom E2E fixtures into #{ActiveRecord::Base.connection_db_config.database}."
