import { supabase } from '$lib/supabaseClient';
import { json } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
    try {
        const { query, limit = 10 } = await request.json();
        
        // Call the semantic search function
        const { data, error } = await supabase.rpc('search_problems', {
            query_text: query,
            match_count: limit
        });

        if (error) throw error;

        return json({ problems: data });
    } catch (error) {
        console.error('Semantic search error:', error);
        return json({ error: error.message }, { status: 500 });
    }
}
