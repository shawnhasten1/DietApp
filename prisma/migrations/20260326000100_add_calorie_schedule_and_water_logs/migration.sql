-- Add weekday calorie schedule and water goal fields.
ALTER TABLE "user_profiles"
ADD COLUMN "target_calories_sun" INTEGER,
ADD COLUMN "target_calories_mon" INTEGER,
ADD COLUMN "target_calories_tue" INTEGER,
ADD COLUMN "target_calories_wed" INTEGER,
ADD COLUMN "target_calories_thu" INTEGER,
ADD COLUMN "target_calories_fri" INTEGER,
ADD COLUMN "target_calories_sat" INTEGER,
ADD COLUMN "water_goal_oz" INTEGER NOT NULL DEFAULT 64;

-- CreateTable
CREATE TABLE "water_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount_oz" INTEGER NOT NULL,
    "consumed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "water_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "water_logs_user_id_consumed_at_idx" ON "water_logs"("user_id", "consumed_at");

-- AddForeignKey
ALTER TABLE "water_logs" ADD CONSTRAINT "water_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
