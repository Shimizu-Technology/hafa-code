require "test_helper"

class AuditEventTest < ActiveSupport::TestCase
  test "does not allow project source to be copied into audit metadata" do
    event = AuditEvent.new(action: "unsafe", metadata: { source: "puts 'secret'" })

    assert_not event.valid?
    assert_includes event.errors.full_messages, "Metadata cannot include project source"
  end
end
