import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://oehdoulnvxcxepoanqvd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9laGRvdWxudnhjeGVwb2FucXZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzNTU3MjIsImV4cCI6MjA4MTkzMTcyMn0.bzmK_Z_gF1KAsoB4LfTp_wev_K5jD9h0IQJsjbiRX38";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function test() {
  const { data, error } = await supabase
    .from("complaints")
    .select("*")
    .or("current_level.eq.hod,hod_status.is.not.null")
    .limit(1);

  if (error) {
    console.error("ERROR:", error.message);
  } else {
    console.log("SUCCESS");
  }
}

test();
