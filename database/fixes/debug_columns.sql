DO $$ 
DECLARE
    cols text;
BEGIN
    SELECT string_agg(column_name, ', ') INTO cols
    FROM information_schema.columns 
    WHERE table_name = 'internships';
    RAISE NOTICE 'Internships Columns: %', cols;

    SELECT string_agg(column_name, ', ') INTO cols
    FROM information_schema.columns 
    WHERE table_name = 'course_materials';
    RAISE NOTICE 'Course Materials Columns: %', cols;

    SELECT string_agg(column_name, ', ') INTO cols
    FROM information_schema.columns 
    WHERE table_name = 'reviews';
    RAISE NOTICE 'Reviews Columns: %', cols;
END $$;
