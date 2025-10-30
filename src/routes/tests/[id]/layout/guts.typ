#import "@preview/mitex:0.2.3": *

// Override the image function to display the path for missing images.
// Sourced from https://sitandr.github.io/typst-examples-book/book/typstonomicon/try_catch.html
#let scope = mitex-scope
#let maybe-image(path, ..args) = context {
  let path-label = label(path)
  let first-time = query((context { }).func()).len() == 0
  if first-time or query(path-label).len() > 0 {
    [#image(path, ..args)#path-label]
  } else {
    rect(width: 50%, height: 5em, fill: luma(235), stroke: 1pt)[
      #set align(center + horizon)
      Could not find #raw(path)
    ]
  }
}
#{ scope.image = maybe-image }
#let mitex-scope = scope
#let image = maybe-image


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
      ..range(7 * 4 + 1 * 4 * 5).map(i => (
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

#let answer_cell(index, problems, top_of_page) = {
  rect(
    inset: 50pt,
    width: 100%,
    height: 50%,
    stroke: if top_of_page {
      (bottom: pat)
    } else {
      (top: pat)
    },
    grid(
      rows: (1.5fr, 2fr, 2fr, 2fr),
      grid(
        columns: (4fr, 9fr, 1.5fr),
        if not is_local {
          full_box(
            align(
              right,
              box(
                width: 70pt,
                align(left, image(width: 60pt, height: 60pt, "assets/test_logo.png")),
              ),
            ),
          )
        } else {
          ""
        },
        full_box(
          align(
            left + horizon,
            [
              #text(size: 16pt, "Stanford Math Tournament 2024")

              Guts Round Answer Sheet
            ],
          ),
        ),
        align(horizon, text(size: 24pt, weight: "medium", "Set " + str(index + 1))),
      ),
      grid(
        columns: (1fr, 3fr),
        full_box(
          inset: (bottom: 0pt, left: 25pt, rest: 15pt),
          full_box(stroke: 0.5pt, inset: 5pt, align(top + center, "Write team ID here.")),
        ),
        full_box(
          inset: (bottom: 0pt, right: 0pt, rest: 15pt),
          full_box(
            stroke: 0.5pt,
            inset: 5pt,
            align(top + center, "Write team name here."),
          ),
        ),
      ),
      grid(
        columns: (1fr, 1fr),
        ..range(index * 3 + 1, index * 3 + 1 + problems.len()).map(i => {
          grid(
            columns: (1fr, 4fr),
            full_box(align(horizon + center, [#text(size: 16pt, str(i) + ".")])),
            full_box(align(horizon + center, box(width: 100%, height: 60%, stroke: 0.5pt))),
          )
        }),
      ),
    ),
  )
}
#set page(margin: 0pt)

#grid(
  columns: (auto),
  rows: (auto, auto),
  ..problems.chunks(4).enumerate().map(((i, ps)) => (answer_cell(i, ps, true), answer_cell(i, ps, false))).flatten(),
)

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
    *This is set #{ i + 1 }*

    #enum(
      ..range(calc.min(4, problems.len())).map(index => {
        // Special hacky case for certain problem for spacing.
        // TODO: @Tweoss (francis) remove this special case image to the right code.
        // if i * 3 + index + 1 == 4 {
        //   enum.item(
        //     i * 3 + index + 1,
        //     grid(
        //       columns: (auto, 120pt),
        //       eval(
        //         convert_to_typst(
        //           problems.at(index).problem_latex.replace("\n\\image{/image/SMTSemicirclesFinal.png}", ""),
        //         ),
        //         mode: "markup",
        //         scope: mitex-scope,
        //       ),
        //       image(
        //         "problem_images/image/SMTSemicirclesFinal.png",
        //         height: 120pt,
        //         fit: "contain",
        //       ),
        //     ),
        //   )
        // } else {
          enum.item(
            i * 4 + index + 1,
            eval(
              convert_to_typst(problems.at(index).problem_latex),
              mode: "markup",
              scope: mitex-scope,
            ),
          )
        // }
      }),
    )
  ]
}

#let usayno_split = 28
#let (non_usayno, usayno) = (problems.slice(0, usayno_split), problems.slice(usayno_split))

#grid(
  columns: (auto),
  rows: (auto, auto),
  ..non_usayno.chunks(4).enumerate().map(((i, ps)) => (problem_cell(i, ps, true), problem_cell(i, ps, false))).flatten(),
)

#set page(margin: 40pt)

#enum(..usayno.enumerate().map(
  ((i, p)) => {
      enum.item(i + usayno_split + 1, eval(
        convert_to_typst(p.problem_latex),
        mode: "markup",
        scope: mitex-scope
      ))
  }
), tight: false)
