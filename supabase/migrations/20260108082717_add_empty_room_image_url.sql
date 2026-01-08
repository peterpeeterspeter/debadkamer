/*
  # Add Empty Room Image URL to Bathroom Specs

  1. Changes
    - Add `empty_room_image_url` column to `bathroom_specs` table
      - Stores the URL of the AI-generated empty room shell image
      - Used as base for style rendering (image-to-image transformation)
      - Nullable to handle cases where processing fails or is not yet complete

  2. Notes
    - This column enables automatic empty room generation after analysis
    - The empty room preserves architectural features while removing all fixtures
    - Improves render accuracy by maintaining exact room dimensions
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bathroom_specs' AND column_name = 'empty_room_image_url'
  ) THEN
    ALTER TABLE bathroom_specs ADD COLUMN empty_room_image_url text;
  END IF;
END $$;