import os
from supabase import create_client
from dotenv import load_dotenv
load_dotenv()


SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE = os.environ.get("SUPABASE_SERVICE_ROLE")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE env vars")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE)
