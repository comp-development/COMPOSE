#!/usr/bin/env python3
import re
import csv

def parse_tex_file(tex_file):
    """
    Reads the LaTeX file and returns a list of dictionaries.
    Each dictionary corresponds to one problem row with keys:
    'id', 'problem', 'answer', 'solution', 'topic', 'Author', 'comments'.
    The problems are numbered by section index and by occurrence within that section.
    """
    rows = []
    current_section = None
    section_index = 0
    problem_counter = 0

    # Read the file lines.
    with open(tex_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # We will use a simple state machine to collect problem and solution blocks.
    i = 0
    nlines = len(lines)
    
    in_problem = False
    in_solution = False
    current_problem_lines = []
    current_solution_lines = []
    current_author = ""
    
    while i < nlines:
        line = lines[i]
        
        # Check for a \section{...} line to update the topic.
        section_match = re.search(r'\\section\{([^}]+)\}', line)
        if section_match:
            current_section = section_match.group(1).strip()
            section_index += 1
            problem_counter = 0  # Reset the problem counter for a new section.
        
        # If we are not already inside a problem and we see \begin{problem}...
        if not in_problem and re.search(r'\\begin\{problem\}', line):
            in_problem = True
            # Extract an optional [Author] if present.
            author_match = re.search(r'\\begin\{problem\}(?:\[(.*?)\])?', line)
            current_author = author_match.group(1).strip() if author_match and author_match.group(1) else ""
            current_problem_lines = []
            i += 1
            continue

        # When within a problem and we haven't yet started a solution block:
        if in_problem and not in_solution:
            if re.search(r'\\end\{problem\}', line):
                in_problem = False
                # The problem text is what we've collected so far.
                problem_text = "".join(current_problem_lines).strip()
                # Check if a \solution block follows immediately.
                j = i + 1
                while j < nlines and lines[j].strip() == "":
                    j += 1
                if j < nlines and re.search(r'\\begin\{solution\}', lines[j]):
                    in_solution = True
                    current_solution_lines = []
                    # Skip the \begin{solution} line.
                    i = j + 1
                    continue
                else:
                    # No solution provided; create the row.
                    problem_counter += 1
                    row_id = f"{section_index}.{problem_counter}"
                    row = {
                        'id': row_id,
                        'problem': problem_text,
                        'answer': "",
                        'solution': "",
                        'topic': current_section if current_section else "",
                        'Author': current_author,
                        'comments': ""
                    }
                    rows.append(row)
                    i += 1
                    continue
            else:
                # Otherwise, collect the problem text.
                current_problem_lines.append(line)
                i += 1
                continue

        # When inside a solution block:
        if in_solution:
            if re.search(r'\\end\{solution\}', line):
                in_solution = False
                solution_text = "".join(current_solution_lines).strip()
                # Look for a \boxed{...}; if found use its content as the "answer".
                answer_match = re.search(r'\\boxed\{([^}]+)\}', solution_text)
                answer_text = answer_match.group(1).strip() if answer_match else ""
                problem_text = "".join(current_problem_lines).strip()
                problem_counter += 1
                row_id = f"{section_index}.{problem_counter}"
                row = {
                    'id': row_id,
                    'problem': problem_text,
                    'answer': answer_text,
                    'solution': solution_text,
                    'topic': current_section if current_section else "",
                    'Author': current_author,
                    'comments': ""
                }
                rows.append(row)
                # Reset the buffers.
                current_problem_lines = []
                current_solution_lines = []
                i += 1
                continue
            else:
                current_solution_lines.append(line)
                i += 1
                continue

        i += 1
    return rows

def write_csv(rows, csv_file):
    """
    Writes out the CSV file with the headers:
    id, problem, answer, solution, topic, Author, comments.
    """
    fieldnames = ['id', 'problem', 'answer', 'solution', 'topic', 'Author', 'comments']
    with open(csv_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)

def main():
    tex_file = "scripts/brumo.tex"
    csv_file = "scripts/brumo.csv"
    rows = parse_tex_file(tex_file)
    write_csv(rows, csv_file)
    print(f"Converted {tex_file} to {csv_file}")

if __name__ == '__main__':
    main() 