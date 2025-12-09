/*
  # Bathroom Configurator Database Schema

  1. New Tables
    - `leads`
      - `id` (uuid, primary key) - Unique lead identifier
      - `created_at` (timestamptz) - When the lead was created
      - `name` (text) - Customer name
      - `email` (text) - Customer email
      - `phone` (text) - Customer phone number
      - `spec_json` (jsonb) - Full bathroom specification analysis
      - `render_url` (text) - URL to generated render image
      - `lead_score` (text) - AI-generated lead quality score
      - `status` (text) - Lead status (new, contacted, qualified, closed)
      - `session_id` (text) - Analytics session ID for funnel tracking
      - `metadata` (jsonb) - Additional data (selected style, price point, etc.)
    
    - `bathroom_specs`
      - `id` (uuid, primary key) - Unique spec identifier
      - `created_at` (timestamptz) - When the analysis was done
      - `session_id` (text) - Analytics session ID
      - `image_url` (text) - Original uploaded image URL
      - `spec_json` (jsonb) - Full analysis results from Gemini
      - `confidence_score` (float) - AI confidence in analysis
      - `dimensions` (jsonb) - Extracted dimensions
      - `fixtures` (jsonb) - Identified fixtures
      - `style_preferences` (jsonb) - Detected style elements
    
    - `renders`
      - `id` (uuid, primary key) - Unique render identifier
      - `created_at` (timestamptz) - When render was generated
      - `session_id` (text) - Analytics session ID
      - `spec_id` (uuid) - Reference to bathroom_specs
      - `selected_style` (text) - Style chosen by user
      - `render_url` (text) - URL to generated image
      - `prompt_used` (text) - Prompt sent to image generation API
      - `generation_time_ms` (int) - Time taken to generate
      - `feedback_rating` (int) - User rating (1-5)
    
    - `analytics_events`
      - `id` (uuid, primary key) - Unique event identifier
      - `created_at` (timestamptz) - When event occurred
      - `session_id` (text) - Analytics session ID
      - `event_type` (text) - Type of event (page_view, upload, analyze, render, submit)
      - `event_data` (jsonb) - Event-specific data
      - `user_agent` (text) - Browser user agent
      - `ip_address` (text) - User IP (for analytics)

  2. Security
    - Enable RLS on all tables
    - Allow public INSERT for leads, specs, renders, and analytics (user submission)
    - Allow public SELECT for specs and renders (user can view their results)
    - Restrict admin endpoints to authenticated users only
    - Analytics events are write-only for public (no SELECT)

  3. Indexes
    - Index on session_id for funnel analysis
    - Index on created_at for time-based queries
    - Index on lead status for dashboard filtering
    - Index on event_type for analytics queries
*/

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  spec_json jsonb,
  render_url text,
  lead_score text,
  status text DEFAULT 'new',
  session_id text,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Create bathroom_specs table
CREATE TABLE IF NOT EXISTS bathroom_specs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  session_id text,
  image_url text,
  spec_json jsonb NOT NULL,
  confidence_score float,
  dimensions jsonb,
  fixtures jsonb,
  style_preferences jsonb
);

-- Create renders table
CREATE TABLE IF NOT EXISTS renders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  session_id text,
  spec_id uuid REFERENCES bathroom_specs(id),
  selected_style text,
  render_url text,
  prompt_used text,
  generation_time_ms int,
  feedback_rating int CHECK (feedback_rating >= 1 AND feedback_rating <= 5)
);

-- Create analytics_events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  session_id text NOT NULL,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb,
  user_agent text,
  ip_address text
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_session_id ON leads(session_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);

CREATE INDEX IF NOT EXISTS idx_specs_session_id ON bathroom_specs(session_id);
CREATE INDEX IF NOT EXISTS idx_specs_created_at ON bathroom_specs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_renders_session_id ON renders(session_id);
CREATE INDEX IF NOT EXISTS idx_renders_spec_id ON renders(spec_id);
CREATE INDEX IF NOT EXISTS idx_renders_created_at ON renders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_session_id ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics_events(created_at DESC);

-- Enable Row Level Security
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE bathroom_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE renders ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for leads table
CREATE POLICY "Allow public to insert leads"
  ON leads FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to view all leads"
  ON leads FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to update leads"
  ON leads FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for bathroom_specs table
CREATE POLICY "Allow public to insert specs"
  ON bathroom_specs FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public to view specs"
  ON bathroom_specs FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated users to view all specs"
  ON bathroom_specs FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for renders table
CREATE POLICY "Allow public to insert renders"
  ON renders FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public to view renders"
  ON renders FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated users to view all renders"
  ON renders FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for analytics_events table (write-only for public)
CREATE POLICY "Allow public to insert analytics events"
  ON analytics_events FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to view analytics"
  ON analytics_events FOR SELECT
  TO authenticated
  USING (true);