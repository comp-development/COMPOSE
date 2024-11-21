<script>
	import { getGrades } from "$lib/supabase";

    let grades = {};

    async function handleButtonClick() {
        console.log('Trying');
        grades = await getGrades();
        console.log('Grades:', grades);
        exportToCSV(grades);
    }

    function exportToCSV(data) {
        const csvContent = generateCSVContent(data);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'grades.csv');
        link.click();
    }

    function generateCSVContent(data) {
        let csvContent = "TestName;TakerID;Name;Score;Grades\n";
        
        for (const testName in data) {
            const test = data[testName];
            for (const takerID in test) {
                const taker = test[takerID];
                const name = taker.name;
                const score = taker.score;
                const grades = `"${taker.grades.join(",")}"`;
                csvContent += `${testName};${takerID};${name};${score};${grades}\n`;
            }
        }
        
        return csvContent;
    }
</script>

<div>
    <button on:click={handleButtonClick}>Export Results</button>
</div>