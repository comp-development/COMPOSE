<script>
	import "carbon-components-svelte/css/white.css";
	import Button from "$lib/components/Button.svelte";
    import toast from "svelte-french-toast";
    import { handleError } from "$lib/handleError";
    // import { updateAllProblemEmbeddings } from '$lib/supabase/problems';
    import { json } from '@sveltejs/kit';


    // this is an admin button that will generate new embeddings for all problems
    // Needed this initially when initially populatin all embeddings
    // commented out now, but leaving it in just in case mass embedding update is needed.
    // let isUpdatingEmbeddings = false;

    // async function updateEmbeddings() {
    //     try {
    //         console.log("Updating embeddings... button clicked");
    //         isUpdatingEmbeddings = true;
            
    //         const response = json(await updateAllProblemEmbeddings());

    //         // const response = await fetch('/api/admin/update-embeddings', {
    //         //     method: 'POST'
    //         // });
            
    //         if (!response.ok) {
    //             const error = await response.json();
    //             throw new Error(error.error || 'Failed to update embeddings');
    //         }
            
    //         const result = await response.json();
    //         toast.success(`Successfully updated embeddings for ${result.count} problems`);
    //     } catch (error) {
    //         handleError(error);
    //         toast.error('Failed to update embeddings: ' + error.message);
    //     } finally {
    //         isUpdatingEmbeddings = false;
    //     }
    // }
</script>

<br />
<h1>Admin: Portal</h1>
<br />
<Button href="/admin/users" title="Users" />
<br />
<br />
<Button href="/admin/tests" title="Tests" />
<br />
<br />
<Button href="/admin/testsolves" title="Manage Testsolves" />
<br />
<br />
<Button href="/admin/transfer-problem" title="Transfer Problem" />
<br />
<br />
<Button href="/admin/tournaments" title="Tournaments" />
<br />
<br />

<!-- <div class="admin-section">
    <h2>Problem Management</h2>
    <div class="button-group">
        <Button 
            title={isUpdatingEmbeddings ? "Updating Embeddings..." : "Update Problem Embeddings"}
            action={isUpdatingEmbeddings ? null : updateEmbeddings}
        />
    </div>
</div> -->

<style>
    /* .admin-section {
        margin: 2rem 0;
    } */
    .button-group {
        display: flex;
        gap: 1rem;
        margin-top: 1rem;
    }
</style>
