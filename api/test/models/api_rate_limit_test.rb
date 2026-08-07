require "test_helper"

class ApiRateLimitTest < ActiveSupport::TestCase
  include ActiveSupport::Testing::TimeHelpers

  test "persists request counts and resets after the time window" do
    assert_not ApiRateLimit.exceeded?("test:student", limit: 2, period: 1.hour)
    assert_not ApiRateLimit.exceeded?("test:student", limit: 2, period: 1.hour)
    assert ApiRateLimit.exceeded?("test:student", limit: 2, period: 1.hour)

    travel 61.minutes do
      assert_not ApiRateLimit.exceeded?("test:student", limit: 2, period: 1.hour)
    end
  end
end
