class AuditEvent < ApplicationRecord
  belongs_to :actor, class_name: "User", optional: true
  belongs_to :organization, optional: true
  belongs_to :target, polymorphic: true, optional: true

  validates :action, presence: true, length: { maximum: 120 }
  validate :metadata_does_not_include_source

  private

  def metadata_does_not_include_source
    forbidden_keys = %w[content source files snapshot]
    return unless metadata.to_h.keys.map(&:to_s).intersect?(forbidden_keys)

    errors.add(:metadata, "cannot include project source")
  end
end
