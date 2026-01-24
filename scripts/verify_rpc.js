
const { createClient } = require('@supabase/supabase-js');

const url = 'https://vfarpknicgxlrherrqnb.supabase.co';
const key = 'sb_publishable_mXKO6j3q4rMcHxjXfFY3fA_XOCNH8GU';
const supabase = createClient(url, key);

async function check() {
    const { data, error } = await supabase.rpc('get_or_create_conversation', {
        current_user_id: '00000000-0000-0000-0000-000000000000',
        target_user_id: '00000000-0000-0000-0000-000000000000'
    });

    if (error) {
        console.log('RPC Error:', error.message, error.code, error.details);
    } else {
        console.log('RPC exists and executed (Data):', data);
    }
}

check();
