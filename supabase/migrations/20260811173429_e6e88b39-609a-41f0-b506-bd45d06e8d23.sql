UPDATE public.distribution_lists
   SET last_assigned_contact_id = '12ecc19e-ee6c-4ceb-9f14-36f427a009da',
       next_contact_id = NULL,
       updated_at = now()
 WHERE id = 'cc24a0a3-a1be-4950-8504-b6653e1254be';