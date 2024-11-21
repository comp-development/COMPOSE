#import "@preview/mitex:0.2.3": *

#let is_local = toml("./answer_sheet_compiling.toml").config.local
#let (problems, test_metadata) = if is_local {
  (
    (
      (
        problem_latex: "What is $\\frac{1}{2} + \\frac{1}4?$",
        answer_latex: "$\\frac{3}{4}$",
        solution_latex: "Think deeply, then guess the answer.",
      ),
      (
        problem_latex: "Count how many toes you have. What is that number divided by $2$?",
        answer_latex: "5",
        solution_latex: "Hopefully, you find that the left foot has 5, the right foot has 5, and the sum is $10.$ Then, we have $\\frac{10}2 = \\boxed{5\\frac{\\frac{10}{3}2}{1}}.$",
      ),
      ..range(20).map(i => (
        problem_latex: "Problem # " + str(i),
        answer_latex: "Generic answer",
        solution_latex: "Generic solution",
      )),
    ),
    (
      name: "Test Name",
      id: "T16",
      day: 13,
      month: 4,
      year: 2024,
      team_test: false,
      display: (answers: true, solutions: true),
    ),
  )
} else {
  (json("/assets/problems.json"), json("/assets/test_metadata.json"))
}

// Set page size and set page header for answer sheet boxes.
#set page(margin: 0pt, height: 11in, width: 8.5in)

#let problem_count = problems.len()

#let full_box(stroke: none, inset: 0pt, content) = box(width: 100%, height: 100%, stroke: stroke, inset: inset, content)

// Typeset problems.
#let macros = (
  // Boxing answers
  "\\ans": ("[1]", "\\boxed{#1}"),
  // Wrap with absolute value
  "\\Abs": ("[1]", "\\left\\lVert #1 \\right\\rVert"),
  // Wrap with < > angle brackets
  "\\ang": ("[1]", "\\left \\langle #1 \\right \\rangle"),
  // Set notation {x, y}
  "\\set": ("[1]", "\\left\\{#1\\right\\}"),
  // Scaled parentheses
  "\\paren": ("[1]", "\\left(#1\\right)"),
  // Floor brackets
  "\\floor": ("[1]", "\\left\\lfloor #1 \\right\\rfloor"),
  // Ceiling brackets
  "\\ceil": ("[1]", "\\left\\lceil #1 \\right\\rceil"),
  // Vector notation, overarrow
  "\\VEC": ("[1]", "\\overrightarrow{#1}"),
  // Modulus operator
  "\\Mod": ("[1]", "\\enspace(\\text{mod}\\ #1)"),
).pairs().map(pair => {
  let (name, value) = pair
  let (arg_count, body) = value
  "\\newcommand{" + name + "}" + arg_count + "{" + body + "}"
}).join()

#let replace_image(latex, convert) = {
  let no_end_brace = `[^\}]`.text
  let image_regex = regex(`\\(image|includegraphics)(\[[^\]]*\])*\{(`.text + no_end_brace + `+)\}`.text)
  latex = latex.replace(
    image_regex,
    (m, ..) => {
      let path = "/problem_images" + m.captures.last()
      "\\iftypst\n #figure(image(\"" + path + "\", height: 110pt))\n\\fi"
    },
  )
  // Super lazy for now, until https://github.com/mitex-rs/mitex/pull/152 is resolved.
  // Regex finitely many nested brace pairs.
  let no_brace = `[^\{\}]`.text
  let brace_pair_list(center_regex) = no_brace + `*(\{`.text + center_regex + `\}`.text + no_brace + `*)*`.text
  let nested_brace_pairs(count) = if count == 1 {
    brace_pair_list(no_brace + "*")
  } else {
    brace_pair_list(nested_brace_pairs(count - 1))
  }
  let boxed_regex = regex(`\\(boxed|ans)\{(`.text + nested_brace_pairs(4) + `)\}`.text)
  latex.replace(
    boxed_regex,
    (m, ..) => {
      "\\iftypst#pad(y: 4pt, move(dy: -1pt, box(stroke: 0.5pt, inset: (x: 2pt, y: 6pt), [" + mitex-convert(
        mode: "text",
        "$" + m.captures.at(1) + "$",
      ) + "])))\\fi"
    },
  )
}

#let convert_to_typst(latex) = {
  // When mitex supports brackets, we can remove this.
  latex = latex.replace("\\(", "$")
  latex = latex.replace("\\)", "$")
  latex = latex.replace("\\[", "$$")
  latex = latex.replace("\\]", "$$")
  mitex-convert(mode: "text", macros + replace_image(latex, convert_to_typst))
}

// Creates a pattern for a marker line.
#let line_length = 0.5in
#let pat = pattern(size: (8.5in - line_length, 0.1in))[
  #place(line(start: (0%, 0%), end: (line_length, 0%)))
]

#set page(margin: 0pt)

#let problem_cell(i, problems, top_of_page) = {
  rect(
    inset: (x: 0.5in, y: 0.5in),
    width: 100%,
    height: 50%,
    stroke: if top_of_page {
      (bottom: pat)
    } else {
      (top: pat)
    },
  )[
    #set text(size: 11pt, font: "New Computer Modern")
    *#{ test_metadata.name }*

    #enum(
      ..range(calc.min(3, problems.len())).map(index => {
        enum.item(
          i * 3 + index + 1,
          eval(
            convert_to_typst(problems.at(index).problem_latex),
            mode: "markup",
            scope: mitex-scope,
          ),
        )
      }),
    )
  ]
}

#grid(
  columns: (auto), rows: (auto, auto), ..problems.chunks(3).enumerate().map(((i, ps)) => (
    problem_cell(i, ps, true),
    problem_cell(i, ps, false),
  )).flatten(),
)
