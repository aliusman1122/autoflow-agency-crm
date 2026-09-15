const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

if (fs.existsSync('.env')) {
    const content = fs.readFileSync('.env', 'utf-8');
    content.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim();
            process.env[key] = val;
        }
    });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE URL or KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
    console.log('--- DB DIAGNOSTICS ---');
    console.log('Target URL:', supabaseUrl);

    // Try leads
    const { data: leadsData, error: leadsError } = await supabase.from('leads').select('*').limit(1);
    if (leadsError) {
        console.error('Error fetching leads:', leadsError.message);
    } else {
        console.log('✅ "leads" table exists in the public schema.');
    }

    // Try invoices
    const { data: invoicesData, error: invoicesError } = await supabase.from('invoices').select('*').limit(1);
    if (invoicesError) {
        console.error('Error fetching invoices:', invoicesError.message);
    } else {
        console.log('✅ "invoices" table exists in the public schema.');
    }

    // Try profiles
    const { data: profiles, error: profError } = await supabase.from('profiles').select('*').limit(1);
    if (profError) {
        console.error('Error fetching profiles:', profError.message);
    } else {
        console.log('✅ "profiles" table exists in the public schema.');
    }
}

checkTables();
