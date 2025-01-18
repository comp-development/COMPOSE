// src/lib/api/submitProblem.js
import OpenAI from "openai";
const openai = new OpenAI();
openai.apiKey = process.env.OPENAI_API_KEY();

export async function getOpenAITopics(payload) {
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: "developer",
                    content: "Please return a list of 3-5 topics most relevant to this problem in a JSON array. An example of output might be [Geometry, Ceva, median, triangle]."
                },
                {
                    role: "user",
                    content: `Please classify this problem and solution pair: ${payload.problem_latex} ${payload.solution_latex}`
                },
            ],
            response_format: { type: "json_object" }
        });

        console.log(response.choices[0].message.content);

        return response.choices[0].message.content; 
    } 
    catch (error) {
        console.error('Error querying OpenAI for topics:', error);
        throw error; // Rethrow the error for handling in the calling function
    }
}