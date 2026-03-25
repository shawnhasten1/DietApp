-- Add optional user-entered TDEE used for deficit and timeline estimates.
ALTER TABLE "user_profiles"
ADD COLUMN "avg_tdee_calories" INTEGER;
