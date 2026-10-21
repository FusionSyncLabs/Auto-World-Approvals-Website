GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

COMMENT ON FUNCTION public.is_admin(uuid) IS 'Server-side helper used by admin dashboard policies and functions to verify admin or superadmin access.';
COMMENT ON FUNCTION public.has_role(uuid, public.app_role) IS 'Server-side helper used by admin dashboard policies and functions to verify a user role without recursive RLS checks.';