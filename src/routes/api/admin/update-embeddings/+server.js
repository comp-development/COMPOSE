import { json } from '@sveltejs/kit';
// import { supabase } from '$lib/supabase/client';
import { updateAllProblemEmbeddings } from '$lib/supabase/problems';
// import { isAdmin } from '$lib/auth';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
    try {
        // Check if user is authenticated
        // const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        // if (sessionError || !session) {
        //     return json({ error: 'Unauthorized' }, { status: 401 });
        // }

        // // Check if user is admin
        // const isUserAdmin = await isAdmin(session.user.id);
        // if (!isUserAdmin) {
        //     return json({ error: 'Forbidden' }, { status: 403 });
        // }
        console.log('Calling Updating embeddings...');

        const result = await updateAllProblemEmbeddings(); 
        return json(result);
    } catch (error) {
        console.error('Error in update-embeddings:', error);
        return json({ error: error.message }, { status: 500 });
    }
}
