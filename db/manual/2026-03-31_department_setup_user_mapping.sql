ALTER TABLE department_approval_setup
  ADD COLUMN IF NOT EXISTS reviewer_user_id UUID REFERENCES users(user_id),
  ADD COLUMN IF NOT EXISTS hod_user_id UUID REFERENCES users(user_id),
  ADD COLUMN IF NOT EXISTS fallback_user_id UUID REFERENCES users(user_id);

UPDATE department_approval_setup das
SET reviewer_user_id = COALESCE(
      das.reviewer_user_id,
      (
        SELECT u.user_id
        FROM users u
        WHERE u.department_id = das.department_id
          AND u.position_id = das.reviewer_position_id
        ORDER BY u.updated_at DESC, u.created_at ASC
        LIMIT 1
      )
    ),
    hod_user_id = COALESCE(
      das.hod_user_id,
      (
        SELECT u.user_id
        FROM users u
        WHERE u.department_id = das.department_id
          AND u.position_id = das.hod_position_id
        ORDER BY u.updated_at DESC, u.created_at ASC
        LIMIT 1
      )
    ),
    fallback_user_id = COALESCE(
      das.fallback_user_id,
      (
        SELECT u.user_id
        FROM users u
        WHERE u.department_id = das.department_id
          AND u.position_id = das.fallback_position_id
        ORDER BY u.updated_at DESC, u.created_at ASC
        LIMIT 1
      )
    );
