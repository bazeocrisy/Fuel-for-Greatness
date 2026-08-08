-- seed.sql — Fuel for Greatness reference data (Phase 2)
-- Generated from the wizard’s own CATS / EXTRAS / KIDS lists so the two cannot drift.
-- Safe to re-run: every statement is INSERT OR IGNORE against a UNIQUE key.

INSERT OR IGNORE INTO families (slug, display_name) VALUES ('bazemore', 'Bazemore Family');

INSERT OR IGNORE INTO children (family_id, slug, full_name, first_name, grade, accent)
  SELECT id, 'gabriella', 'Ms. Gabriella Bazemore', 'Gabriella', '5th Grade', '#9F3CAB' FROM families WHERE slug = 'bazemore';
INSERT OR IGNORE INTO children (family_id, slug, full_name, first_name, grade, accent)
  SELECT id, 'christopher', 'Mr. Christopher Bazemore II', 'Christopher', '3rd Grade', '#4569CA' FROM families WHERE slug = 'bazemore';

INSERT OR IGNORE INTO food_categories (slug, display_name, emoji, sort_order) VALUES ('protein', 'Proteins', '💪', 1);
INSERT OR IGNORE INTO food_categories (slug, display_name, emoji, sort_order) VALUES ('carbs', 'Energy Foods', '⚡', 2);
INSERT OR IGNORE INTO food_categories (slug, display_name, emoji, sort_order) VALUES ('fruit', 'Fruit', '🍓', 3);
INSERT OR IGNORE INTO food_categories (slug, display_name, emoji, sort_order) VALUES ('veg', 'Vegetables', '🥦', 4);
INSERT OR IGNORE INTO food_categories (slug, display_name, emoji, sort_order) VALUES ('dairy', 'Dairy', '🥛', 5);
INSERT OR IGNORE INTO food_categories (slug, display_name, emoji, sort_order) VALUES ('cold', 'Cold Lunches', '🧊', 6);
INSERT OR IGNORE INTO food_categories (slug, display_name, emoji, sort_order) VALUES ('thermos', 'Thermos Meals', '🔥', 7);
INSERT OR IGNORE INTO food_categories (slug, display_name, emoji, sort_order) VALUES ('snacks', 'Snacks', '🍎', 8);
INSERT OR IGNORE INTO food_categories (slug, display_name, emoji, sort_order) VALUES ('drinks', 'Drinks', '💧', 9);
INSERT OR IGNORE INTO food_categories (slug, display_name, emoji, sort_order) VALUES ('extras', 'Dips & Extras', '🥄', 10);

-- Proteins — 28 items
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Grilled Chicken', '🍗' FROM food_categories WHERE slug = 'protein';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Rotisserie Chicken', '🍗' FROM food_categories WHERE slug = 'protein';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Chicken Strips (baked)', '🍗' FROM food_categories WHERE slug = 'protein';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Sliced Turkey (low sodium)', '🦃' FROM food_categories WHERE slug = 'protein';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Ground Turkey', '🦃' FROM food_categories WHERE slug = 'protein';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Lean Ground Beef', '🥩' FROM food_categories WHERE slug = 'protein';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Meatballs', '🍢' FROM food_categories WHERE slug = 'protein';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Pork Tenderloin', '🥩' FROM food_categories WHERE slug = 'protein';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Chicken Sausage', '🌭' FROM food_categories WHERE slug = 'protein';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Hard-Boiled Eggs', '🥚' FROM food_categories WHERE slug = 'protein';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Scrambled Eggs', '🍳' FROM food_categories WHERE slug = 'protein';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Egg Salad', '🥚' FROM food_categories WHERE slug = 'protein';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Tuna', '🐟' FROM food_categories WHERE slug = 'protein';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Salmon', '🐟' FROM food_categories WHERE slug = 'protein';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Shrimp', '🍤' FROM food_categories WHERE slug = 'protein';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Black Beans', '🫘' FROM food_categories WHERE slug = 'protein';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Pinto Beans', '🫘' FROM food_categories WHERE slug = 'protein';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Chickpeas', '🫘' FROM food_categories WHERE slug = 'protein';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Lentils', '🍲' FROM food_categories WHERE slug = 'protein';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Edamame', '🫛' FROM food_categories WHERE slug = 'protein';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Hummus', '🥣' FROM food_categories WHERE slug = 'protein';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Tofu', '🍥' FROM food_categories WHERE slug = 'protein';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Cottage Cheese', '🥛' FROM food_categories WHERE slug = 'protein';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Greek Yogurt', '🥄' FROM food_categories WHERE slug = 'protein';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Cheese Sticks', '🧀' FROM food_categories WHERE slug = 'protein';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Sunflower Seed Butter', '🌻' FROM food_categories WHERE slug = 'protein';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Pumpkin Seeds', '🎃' FROM food_categories WHERE slug = 'protein';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Sunflower Seeds', '🌻' FROM food_categories WHERE slug = 'protein';

-- Energy Foods — 23 items
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Whole Wheat Bread', '🍞' FROM food_categories WHERE slug = 'carbs';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Whole Wheat Tortilla', '🌯' FROM food_categories WHERE slug = 'carbs';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Corn Tortilla', '🫓' FROM food_categories WHERE slug = 'carbs';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Whole Grain Pita', '🫓' FROM food_categories WHERE slug = 'carbs';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Whole Grain Naan', '🫓' FROM food_categories WHERE slug = 'carbs';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'English Muffin', '🥯' FROM food_categories WHERE slug = 'carbs';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Bagel Thin', '🥯' FROM food_categories WHERE slug = 'carbs';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Brown Rice', '🍚' FROM food_categories WHERE slug = 'carbs';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'White Rice', '🍚' FROM food_categories WHERE slug = 'carbs';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Whole Wheat Pasta', '🍝' FROM food_categories WHERE slug = 'carbs';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Regular Pasta', '🍝' FROM food_categories WHERE slug = 'carbs';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Quinoa', '🌾' FROM food_categories WHERE slug = 'carbs';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Couscous', '🌾' FROM food_categories WHERE slug = 'carbs';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Farro', '🌾' FROM food_categories WHERE slug = 'carbs';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Oatmeal', '🥣' FROM food_categories WHERE slug = 'carbs';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Whole Grain Cereal', '🥣' FROM food_categories WHERE slug = 'carbs';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Whole Grain Waffles', '🧇' FROM food_categories WHERE slug = 'carbs';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Whole Grain Crackers', '🍘' FROM food_categories WHERE slug = 'carbs';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Rice Cakes', '🍘' FROM food_categories WHERE slug = 'carbs';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Sweet Potato', '🍠' FROM food_categories WHERE slug = 'carbs';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Potatoes', '🥔' FROM food_categories WHERE slug = 'carbs';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Corn', '🌽' FROM food_categories WHERE slug = 'carbs';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Popcorn', '🍿' FROM food_categories WHERE slug = 'carbs';

-- Fruit — 25 items
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Strawberries', '🍓' FROM food_categories WHERE slug = 'fruit';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Blueberries', '🫐' FROM food_categories WHERE slug = 'fruit';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Raspberries', '🍇' FROM food_categories WHERE slug = 'fruit';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Blackberries', '🫐' FROM food_categories WHERE slug = 'fruit';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Apple Slices', '🍎' FROM food_categories WHERE slug = 'fruit';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Green Grapes', '🍇' FROM food_categories WHERE slug = 'fruit';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Red Grapes', '🍇' FROM food_categories WHERE slug = 'fruit';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Banana', '🍌' FROM food_categories WHERE slug = 'fruit';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Orange', '🍊' FROM food_categories WHERE slug = 'fruit';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Clementines', '🍊' FROM food_categories WHERE slug = 'fruit';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Watermelon', '🍉' FROM food_categories WHERE slug = 'fruit';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Cantaloupe', '🍈' FROM food_categories WHERE slug = 'fruit';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Honeydew', '🍈' FROM food_categories WHERE slug = 'fruit';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Pineapple', '🍍' FROM food_categories WHERE slug = 'fruit';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Mango', '🥭' FROM food_categories WHERE slug = 'fruit';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Peaches', '🍑' FROM food_categories WHERE slug = 'fruit';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Pears', '🍐' FROM food_categories WHERE slug = 'fruit';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Plums', '🟣' FROM food_categories WHERE slug = 'fruit';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Kiwi', '🥝' FROM food_categories WHERE slug = 'fruit';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Cherries', '🍒' FROM food_categories WHERE slug = 'fruit';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Pomegranate', '🔴' FROM food_categories WHERE slug = 'fruit';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Fruit Salad', '🥗' FROM food_categories WHERE slug = 'fruit';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Unsweetened Applesauce', '🍎' FROM food_categories WHERE slug = 'fruit';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Raisins', '🍇' FROM food_categories WHERE slug = 'fruit';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Dried Apricots', '🍑' FROM food_categories WHERE slug = 'fruit';

-- Vegetables — 22 items
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Baby Carrots', '🥕' FROM food_categories WHERE slug = 'veg';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Cucumber Slices', '🥒' FROM food_categories WHERE slug = 'veg';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Cherry Tomatoes', '🍅' FROM food_categories WHERE slug = 'veg';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Bell Pepper Strips', '🫑' FROM food_categories WHERE slug = 'veg';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Sugar Snap Peas', '🫛' FROM food_categories WHERE slug = 'veg';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Celery Sticks', '🥬' FROM food_categories WHERE slug = 'veg';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Broccoli', '🥦' FROM food_categories WHERE slug = 'veg';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Cauliflower', '🥦' FROM food_categories WHERE slug = 'veg';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Green Beans', '🫛' FROM food_categories WHERE slug = 'veg';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Sweet Corn', '🌽' FROM food_categories WHERE slug = 'veg';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Peas', '🫛' FROM food_categories WHERE slug = 'veg';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Edamame Pods', '🫛' FROM food_categories WHERE slug = 'veg';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Spinach', '🥬' FROM food_categories WHERE slug = 'veg';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Romaine Lettuce', '🥬' FROM food_categories WHERE slug = 'veg';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Avocado', '🥑' FROM food_categories WHERE slug = 'veg';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Roasted Sweet Potato', '🍠' FROM food_categories WHERE slug = 'veg';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Zucchini', '🥒' FROM food_categories WHERE slug = 'veg';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Asparagus', '🌿' FROM food_categories WHERE slug = 'veg';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Mushrooms', '🍄' FROM food_categories WHERE slug = 'veg';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Cabbage Slaw', '🥬' FROM food_categories WHERE slug = 'veg';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Jicama Sticks', '🥔' FROM food_categories WHERE slug = 'veg';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Radishes', '🔴' FROM food_categories WHERE slug = 'veg';

-- Dairy — 13 items
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Low-Fat Milk', '🥛' FROM food_categories WHERE slug = 'dairy';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Plain Greek Yogurt', '🥄' FROM food_categories WHERE slug = 'dairy';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Lower-Sugar Yogurt Cup', '🥄' FROM food_categories WHERE slug = 'dairy';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Lower-Sugar Yogurt Tube', '🥄' FROM food_categories WHERE slug = 'dairy';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Kefir', '🥛' FROM food_categories WHERE slug = 'dairy';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Cottage Cheese', '🥣' FROM food_categories WHERE slug = 'dairy';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Cheddar Cubes', '🧀' FROM food_categories WHERE slug = 'dairy';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Mozzarella String Cheese', '🧀' FROM food_categories WHERE slug = 'dairy';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Colby Jack Slices', '🧀' FROM food_categories WHERE slug = 'dairy';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Swiss Slices', '🧀' FROM food_categories WHERE slug = 'dairy';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Mini Cheese Rounds', '🧀' FROM food_categories WHERE slug = 'dairy';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Ricotta', '🥣' FROM food_categories WHERE slug = 'dairy';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Fresh Mozzarella Balls', '⚪' FROM food_categories WHERE slug = 'dairy';

-- Cold Lunches — 18 items
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Turkey & Cheese Roll-Ups', '🌯' FROM food_categories WHERE slug = 'cold';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Turkey Sandwich', '🥪' FROM food_categories WHERE slug = 'cold';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Ham & Cheese Wrap', '🌯' FROM food_categories WHERE slug = 'cold';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Chicken Salad Sandwich', '🥪' FROM food_categories WHERE slug = 'cold';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Tuna Sandwich', '🥪' FROM food_categories WHERE slug = 'cold';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Egg Salad Sandwich', '🥪' FROM food_categories WHERE slug = 'cold';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Sunflower Butter & Jelly', '🥪' FROM food_categories WHERE slug = 'cold';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Chicken Caesar Wrap', '🌯' FROM food_categories WHERE slug = 'cold';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Hummus & Veggie Pita', '🫓' FROM food_categories WHERE slug = 'cold';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Cheese & Cracker Bento', '🍱' FROM food_categories WHERE slug = 'cold';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Protein + Fruit + Veggie Bento', '🍱' FROM food_categories WHERE slug = 'cold';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Pasta Salad', '🥗' FROM food_categories WHERE slug = 'cold';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Cold Chicken & Rice Bowl', '🍚' FROM food_categories WHERE slug = 'cold';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Turkey & Cheese Kabobs', '🍢' FROM food_categories WHERE slug = 'cold';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Greek Yogurt Parfait', '🥄' FROM food_categories WHERE slug = 'cold';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Caprese Skewers', '🍅' FROM food_categories WHERE slug = 'cold';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Cold Quesadilla Triangles', '🫓' FROM food_categories WHERE slug = 'cold';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Chef Salad Box', '🥗' FROM food_categories WHERE slug = 'cold';

-- Thermos Meals — 23 items
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Chicken Noodle Soup', '🍜' FROM food_categories WHERE slug = 'thermos';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Tomato Soup', '🍲' FROM food_categories WHERE slug = 'thermos';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Lentil Soup', '🍲' FROM food_categories WHERE slug = 'thermos';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Minestrone', '🍲' FROM food_categories WHERE slug = 'thermos';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Chili', '🌶️' FROM food_categories WHERE slug = 'thermos';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Mac & Cheese', '🧀' FROM food_categories WHERE slug = 'thermos';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Spaghetti & Meatballs', '🍝' FROM food_categories WHERE slug = 'thermos';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Pasta with Marinara', '🍝' FROM food_categories WHERE slug = 'thermos';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Buttered Noodles & Chicken', '🍝' FROM food_categories WHERE slug = 'thermos';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Chicken Alfredo', '🍝' FROM food_categories WHERE slug = 'thermos';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Chicken & Rice', '🍚' FROM food_categories WHERE slug = 'thermos';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Teriyaki Chicken & Rice', '🍚' FROM food_categories WHERE slug = 'thermos';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Beef & Broccoli', '🥦' FROM food_categories WHERE slug = 'thermos';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Rice & Beans', '🫘' FROM food_categories WHERE slug = 'thermos';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Fried Rice', '🍚' FROM food_categories WHERE slug = 'thermos';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Chicken Quesadilla', '🫓' FROM food_categories WHERE slug = 'thermos';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Taco Rice Bowl', '🌮' FROM food_categories WHERE slug = 'thermos';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Steamed Dumplings', '🥟' FROM food_categories WHERE slug = 'thermos';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Ramen-Style Noodle Bowl', '🍜' FROM food_categories WHERE slug = 'thermos';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Mashed Potatoes & Chicken', '🥔' FROM food_categories WHERE slug = 'thermos';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Sweet Potato & Chicken', '🍠' FROM food_categories WHERE slug = 'thermos';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Eggs & Potatoes', '🍳' FROM food_categories WHERE slug = 'thermos';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Warm Oatmeal', '🥣' FROM food_categories WHERE slug = 'thermos';

-- Snacks — 26 items
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Whole Grain Crackers', '🍘' FROM food_categories WHERE slug = 'snacks';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Popcorn', '🍿' FROM food_categories WHERE slug = 'snacks';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Pretzels', '🥨' FROM food_categories WHERE slug = 'snacks';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Rice Cakes', '🍘' FROM food_categories WHERE slug = 'snacks';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Roasted Chickpeas', '🫘' FROM food_categories WHERE slug = 'snacks';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Sunflower Seeds', '🌻' FROM food_categories WHERE slug = 'snacks';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Pumpkin Seeds', '🎃' FROM food_categories WHERE slug = 'snacks';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Nut-Free Trail Mix', '🥣' FROM food_categories WHERE slug = 'snacks';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Cheese Stick', '🧀' FROM food_categories WHERE slug = 'snacks';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Greek Yogurt Cup', '🥄' FROM food_categories WHERE slug = 'snacks';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Cottage Cheese Cup', '🥣' FROM food_categories WHERE slug = 'snacks';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Hard-Boiled Egg', '🥚' FROM food_categories WHERE slug = 'snacks';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Edamame', '🫛' FROM food_categories WHERE slug = 'snacks';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Apple Slices', '🍎' FROM food_categories WHERE slug = 'snacks';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Clementine', '🍊' FROM food_categories WHERE slug = 'snacks';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Grapes', '🍇' FROM food_categories WHERE slug = 'snacks';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Baby Carrots', '🥕' FROM food_categories WHERE slug = 'snacks';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Cucumber Slices', '🥒' FROM food_categories WHERE slug = 'snacks';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Snap Peas', '🫛' FROM food_categories WHERE slug = 'snacks';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Unsweetened Applesauce Pouch', '🍎' FROM food_categories WHERE slug = 'snacks';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, '100% Fruit Strip', '🍓' FROM food_categories WHERE slug = 'snacks';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Dried Fruit', '🍇' FROM food_categories WHERE slug = 'snacks';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Lower-Sugar Granola Bar', '🍫' FROM food_categories WHERE slug = 'snacks';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Whole Grain Fig Bar', '🍪' FROM food_categories WHERE slug = 'snacks';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Seaweed Snack', '🌿' FROM food_categories WHERE slug = 'snacks';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Veggie Straws', '🥕' FROM food_categories WHERE slug = 'snacks';

-- Drinks — 9 items
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Water', '💧' FROM food_categories WHERE slug = 'drinks';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Water with Lemon', '🍋' FROM food_categories WHERE slug = 'drinks';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Water with Strawberry', '🍓' FROM food_categories WHERE slug = 'drinks';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Water with Cucumber', '🥒' FROM food_categories WHERE slug = 'drinks';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Sparkling Water', '🫧' FROM food_categories WHERE slug = 'drinks';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Low-Fat Milk', '🥛' FROM food_categories WHERE slug = 'drinks';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Coconut Water', '🥥' FROM food_categories WHERE slug = 'drinks';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Small 100% Orange Juice', '🍊' FROM food_categories WHERE slug = 'drinks';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Small 100% Apple Juice', '🍎' FROM food_categories WHERE slug = 'drinks';

-- Dips & Extras — 14 items
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Hummus', '🥣' FROM food_categories WHERE slug = 'extras';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Guacamole', '🥑' FROM food_categories WHERE slug = 'extras';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Salsa', '🍅' FROM food_categories WHERE slug = 'extras';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Salsa Verde', '🌶️' FROM food_categories WHERE slug = 'extras';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Tzatziki', '🥒' FROM food_categories WHERE slug = 'extras';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Greek Yogurt Dip', '🥄' FROM food_categories WHERE slug = 'extras';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Light Ranch', '🥗' FROM food_categories WHERE slug = 'extras';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Honey Mustard', '🍯' FROM food_categories WHERE slug = 'extras';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Marinara for Dipping', '🍝' FROM food_categories WHERE slug = 'extras';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Cream Cheese', '🧀' FROM food_categories WHERE slug = 'extras';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Sunflower Seed Butter', '🌻' FROM food_categories WHERE slug = 'extras';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Lower-Sugar Jam', '🍓' FROM food_categories WHERE slug = 'extras';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Pickles', '🥒' FROM food_categories WHERE slug = 'extras';
INSERT OR IGNORE INTO food_items (category_id, name, emoji)
  SELECT id, 'Olives', '🫒' FROM food_categories WHERE slug = 'extras';
