class ApiRateLimit < ApplicationRecord
  validates :key, presence: true, uniqueness: true
  validates :request_count, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  def self.exceeded?(key, limit:, period:)
    attempts = 0
    begin
      transaction(requires_new: true) do
        now = Time.current
        record = lock.find_by(key: key)
        record ||= create!(key: key, window_started_at: now, request_count: 0)

        if record.window_started_at <= period.ago
          record.update!(window_started_at: now, request_count: 1)
          false
        else
          record.increment!(:request_count)
          record.request_count > limit
        end
      end
    rescue ActiveRecord::RecordNotUnique
      attempts += 1
      retry if attempts < 3

      true
    end
  end
end
