
import { createClient } from '@supabase/supabase-js';

// Hardcoded keys from .env (since we can't easily load .env in a standalone script without dotenv)
const SUPABASE_URL = "https://vfarpknicgxlrherrqnb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_mXKO6j3q4rMcHxjXfFY3fA_XOCNH8GU";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const email = 'system.admin@gmail.com';
const password = 'pukonnect@!';

async function setupAdmin() {
    console.log(`Attempting to set up admin user: ${email}`);

    // 1. Sign Up
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: 'System Admin'
            }
        }
    });

    if (signUpError) {
        console.error('Sign Up Error:', signUpError.message);
        // If user already exists, try signing in to update profile?
        // We can't elevate privileges without logging in.
    } else {
        console.log('Sign Up Request Sent.');
        if (signUpData.user) {
            console.log('User created/found:', signUpData.user.id);
        }
    }

    // 2. Sign In to get a session (needed for RLS if we want to try updating profile)
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (signInError) {
        console.error('Sign In Error:', signInError.message);
        return;
    }

    const user = signInData.user;
    console.log('Logged in successfully.');

    // 3. Attempt to update profile to super_admin
    // This will LIKELY FAIL if RLS policies are active and the protect_role_change trigger is set.
    // But we try anyway.
    try {
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ role: 'super_admin' })
            .eq('id', user.id);

        if (updateError) {
            console.error('Failed to auto-promote to super_admin (Expected if security is active):', updateError.message);
            console.log('ACTION REQUIRED: You must run the SQL script to bypass this security restriction.');
        } else {
            console.log('SUCCESS! User promoted to super_admin.');
        }
    } catch (e) {
        console.error('Exception during promotion:', e);
    }
}

setupAdmin();
