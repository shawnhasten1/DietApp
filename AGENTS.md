# AGENTS.md

## Project Overview

This repository is for a personal, invite-only nutrition and fitness tracking web application intended for a very small number of users, initially two people in the same household.

The application should be simple, mobile-first, and fast to use day to day. Prioritize practical logging workflows over advanced analytics or broad platform features.

## Primary Goal

Build a web app that allows each authenticated user to privately:

- log food and drink intake
- scan or type UPC codes to find packaged foods
- search for food items manually
- track calories and macros
- track exercise and calories burned
- track body weight over time
- maintain profile information such as height, age, and goals
- view a daily summary including net calories

## Required Stack

Unless the repository already contains a stronger established pattern, use the following stack:

- Next.js
- TypeScript
- Prisma
- Neon Postgres
- Tailwind CSS
- Vercel hobby deployment
- npm for package management

Use App Router conventions and modern Next.js best practices.

## Authentication and Access Control

Use Auth.js with both Google OAuth and email/password authentication.

Auth requirements:

- invite-only access
- users must only see and modify their own data
- never trust client-provided user IDs
- infer ownership from the authenticated session on the server
- keep auth and authorization logic server-side

Supported auth methods for v1:

- Google sign-in / sign-up
- email and password sign-up / login

Invite-only model for v1:

- maintain a fixed allowlist of approved email addresses
- only allowlisted email addresses may create an account
- only allowlisted email addresses may sign in
- apply the same allowlist restriction to both Google OAuth and email/password auth
- do not provide open public registration

Recommended implementation approach:

- create an `allowed_emails` table or equivalent allowlist model
- check allowlist status before completing account creation or session creation
- keep password hashing secure if custom credentials auth is implemented
- provide a simple way to manage the small household allowlist in development and production

## Product Scope for v1

The following are the minimum required features for the first version:

1. login
2. user-specific dashboard
3. manual food logging
4. barcode / UPC entry and lookup
5. food search flow
6. exercise logging
7. weight tracking
8. daily calorie and macro summary
9. target daily calories
10. target weight

## UX Principles

- mobile-first responsive design
- optimize for fast daily use on a phone
- minimize taps for repeated actions
- allow manual fallback whenever automation fails
- keep UI clean and utilitarian rather than flashy
- prefer straightforward dashboards over dense reporting

Do not design this as a native app. This is a responsive web application only.

## Measurement and Nutrition Rules

Use US-oriented defaults:

- weight: pounds
- height: feet and inches
- calories: required
- macros: required

Track at minimum:

- calories
- protein_g
- carbs_g
- fat_g

Optional fields for food items if available from provider data:

- fiber_g
- sugar_g
- sodium_mg
- serving_size
- serving_unit
- brand
- upc

Support daily targets for:

- calorie goal
- target weight

Exercise calories should automatically offset daily calorie totals when computing net calories.

Suggested daily summary formula:

- total_consumed_calories
- total_burned_calories
- net_calories = consumed - burned

## Food Entry Workflows

The app must support all of the following:

### 1. Barcode Scan
- scan UPC via device camera
- look up food details through a server-side provider integration
- let user review and edit values before saving

### 2. Manual UPC Entry
- allow typing a barcode manually
- perform the same lookup flow as barcode scan

### 3. Food Search
- allow searching by product or food name
- show likely matches
- allow selection and editing before save

### 4. Fully Manual Entry
- if no provider result exists, allow user to create a food log entry manually

Never block logging just because third-party lookup fails.

## External Nutrition Provider Strategy

Abstract nutrition lookup behind a provider layer.

Requirements:

- do not hardcode provider logic throughout the codebase
- route all provider calls through server-side code
- keep API keys in environment variables
- normalize provider responses into internal app shapes
- allow provider replacement later without large refactors

Initial recommendation:

- start with one branded-food / UPC capable provider
- keep alternative providers swappable later
- always allow manual override before save

## Exercise Tracking

For v1, support manual exercise entry.

Minimum fields:

- activity_name
- duration_minutes
- calories_burned
- performed_at
- notes

Garmin integration is explicitly out of scope for v1.
Design the schema and service layer so future wearable integrations can be added without rewriting the logging model.

## Data Ownership Rules

This application is multi-user but not social.

Rules:

- every log is owned by exactly one user
- users cannot view or modify each other’s logs
- shared household features are out of scope for v1
- if reusable food item records exist, user log records must still remain user-owned

## Suggested Schema Concepts

Use snake_case naming throughout the schema and backend code where practical.

Recommended tables / models:

### users
Authentication identity and account record.

Suggested fields:
- id
- email
- created_at
- updated_at

### user_profiles
Per-user profile and goals.

Suggested fields:
- id
- user_id
- display_name
- date_of_birth or age
- height_feet
- height_inches
- target_weight_lb
- target_calories
- created_at
- updated_at

### allowed_emails
Invite-only access list.

Suggested fields:
- id
- email
- is_active
- created_at
- updated_at
- notes

### weight_entries
Historical body weight records.

Suggested fields:
- id
- user_id
- weight_lb
- recorded_at
- notes
- created_at

### food_items
Normalized reusable food catalog entries from manual creation or external providers.

Suggested fields:
- id
- name
- brand
- upc
- serving_size
- serving_unit
- calories
- protein_g
- carbs_g
- fat_g
- fiber_g
- sugar_g
- sodium_mg
- source
- source_ref
- created_at
- updated_at

### food_logs
User-consumed food records.

Suggested fields:
- id
- user_id
- food_item_id
- servings
- consumed_at
- meal_type
- notes
- created_at

### exercise_logs
User exercise entries.

Suggested fields:
- id
- user_id
- activity_name
- duration_minutes
- calories_burned
- performed_at
- notes
- created_at

## Architecture Guidelines

- keep architecture small and understandable
- prefer server components and server-side data access where appropriate
- use route handlers or server actions based on best fit
- do not overengineer the domain model
- prefer incremental delivery
- isolate provider integrations behind dedicated modules
- keep business logic out of UI components
- use Prisma carefully and keep query logic readable

## Security Requirements

- secure all reads and writes by authenticated user
- enforce authorization on the server
- keep provider secrets in environment variables
- never expose external API keys to the client
- validate all input server-side
- sanitize free-text input where needed
- do not commit secrets, credentials, or real production keys

## Coding Standards

- use TypeScript
- use snake_case naming for database fields and backend data model naming where practical
- keep functions and components focused
- avoid unnecessary abstractions
- prefer clarity over cleverness
- add comments only where intent would otherwise be unclear
- avoid large files when smaller modules improve readability

## Delivery Priorities

When building from scratch, work in this order:

1. app scaffold
2. auth and invite-only gating
3. Prisma schema and database setup
4. profile and goals
5. manual food logging
6. exercise logging
7. weight tracking
8. dashboard summary
9. barcode / UPC lookup flow
10. food search flow
11. polish and validation

## Testing Expectations

Before marking work complete, verify:

- only allowlisted users can sign in
- non-allowlisted users cannot sign up
- Google auth respects allowlist restrictions
- email/password auth respects allowlist restrictions
- one user cannot access another user’s data
- manual food logging works
- UPC lookup success and failure states work
- food search works
- exercise logging works
- weight logging works
- net calorie calculations are correct
- app is usable on mobile-sized screens
- key pages render correctly on Vercel-compatible builds

## Commands

Prefer these commands if available in package.json:

- npm install
- npm run dev
- npm run lint
- npm run typecheck
- npm run test
- npx prisma migrate dev

Always inspect actual repository scripts before assuming commands exist.

## Rules for Codex

When working in this repository:

- read the existing code before making structural changes
- keep diffs focused and incremental
- do not add dependencies without a clear need
- do not rewrite working code without justification
- prefer MVP functionality over speculative architecture
- use best practices for the chosen stack when project rules are silent
- explain important schema or auth decisions in plain language
- keep third-party nutrition provider logic isolated and swappable

## Explicitly Out of Scope for v1

Do not build these unless explicitly requested:

- native iOS or Android apps
- social or shared household meal features
- Garmin integration
- wearable sync
- meal planning
- recipe builder
- AI coaching
- notifications
- admin panel
- advanced analytics