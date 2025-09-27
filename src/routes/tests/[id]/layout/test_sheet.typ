#import "@preview/mitex:0.2.3": *
#import "@preview/codetastic:0.2.2": qrcode
#import "@preview/tablex:0.0.8": gridx, hlinex, vlinex

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
      display: (problems: true, answers: true, solutions: true),
    ),
  )
} else {
  (json("/assets/problems.json"), json("/assets/test_metadata.json"))
}

// Make a qr code in a box.
#let make_qr(qr_string) = {
  let qr = (length: 70pt)
  let stroke = 2pt
  let qr_box = (length: qr.length + 2 * stroke, stroke: stroke)
  let font-size = 8pt

  set text(font-size)

  let in_box(target_string) = {
    box(
      width: qr_box.length,
      [
        #qrcode(target_string, width: qr.length, quiet-zone: 0, ecl: "l")

        #target_string
      ],
      inset: 2pt,
    )
  }
  let qr_and_text = in_box(qr_string)

  align(
    center,
    style(styles => {
      let (width, height) = measure(qr_and_text, styles)
      let padding = 4pt
      box(
        width: width + padding,
        height: height + padding,
        stroke: qr_box.stroke,
        align(center + horizon, qr_and_text),
        inset: padding + qr_box.stroke / 2,
      )
    }),
  )
}

#let id_label(id) = {
  // QR code and text to the right.
  box(
    width: 2.625in,
    height: 1in,
    stroke: 1pt + gray,
    radius: 6pt,
    inset: 0pt,
    fill: white,
  )[
    // Two column grid with a dividing line.
    #gridx(
      columns: (1in, 1fr),
      rows: 1fr,
      qrcode(id, width: 0.8in, quiet-zone: 0, ecl: "l"),
      align: center + horizon,
      vlinex(),
      id,
    )
  ]
}

#let id_box(fill: none, inset: 8pt, content) = {
  let stroke = 1pt
  box(
    width: 2.625in + stroke * 2,
    height: 1in + stroke * 2,
    stroke: stroke,
    radius: 3pt,
    inset: inset,
    fill: fill,
    content,
  )
}

#let identification_sticker_box = {
  id_box(
    fill: gray.lighten(50%),
    if is_local {
      set text(size: 16pt)
      id_label("001A")
    } else {
      "Place Identification Sticker Here"
    },
  )
}

#let written_identification_box = {
  set text(10pt)
  let rows = if test_metadata.team_test {
    ([Team ID (e.g. 001): ], [Team Name: ])
  } else {
    ([Student ID (e.g. 001A): ], [Student Name: ], [Team Name: ])
  }
  id_box(
    inset: 0pt,
    gridx(
      columns: 100%,
      rows: rows.map(_ => 1fr),
      align: start + horizon,
      stroke: 0.5pt,
      ..rows.intersperse(hlinex()),
    ),
  )
}

// Set page size and set page header for answer sheet boxes.
#set page(
  header: locate(location => [
    #set text(10pt)
    #if not is_local {
      place(
        top + left,
        dy: 20pt,
        image(width: 70pt, height: 70pt, "/assets/test_logo.png"),
      )
    }
    #place(
      top + right,
      dy: 10pt,
      make_qr(test_metadata.id + "P" + str(location.page())),
    )
    #align(
      center + horizon,
      [
        #text(
          weight: "bold",
          18pt,
          test_metadata.name
            + " Test ("
            + if test_metadata.team_test {
              "Team"
            } else {
              "Individual"
            }
            + ")",
        ) \ \
        #text(12pt, "Stanford Math Tournament") \
        #v(0pt)
        #text(
          10pt,
          datetime(
            day: test_metadata.day,
            month: test_metadata.month,
            year: test_metadata.year,
          ).display("[month repr:short] [day], [year padding:zero repr:full]"),
        )
      ],
    )
    #grid(
      columns: (1fr, 1fr),
      align(center + horizon, written_identification_box),
      align(center + horizon, identification_sticker_box),
    )
    // Add dividing line (and measure it for querying)
    #layout(size => {
      style(styles => {
        let elem = line(
          start: (0%, 0%),
          end: (100% * size.width, 0%),
          stroke: 1pt,
        )
        // 1-indexed page counter
        [#elem #metadata(measure(elem, styles)) #label(
            "header_line_" + str(counter(page).at(location).first() - 1),
          )]
      })
    })
  ]),
  footer: {
    // A marker at the bottom left for alignment.
    // Uses 1-1-3 ratios of black-white-black.
    let center_y = -30pt
    let scale = 2
    for (radius, fill) in (
      (7pt * scale, black),
      (5pt * scale, white),
      (3pt * scale, black),
    ) {
      place(
        bottom + left,
        dx: -radius,
        dy: center_y + radius,
        circle(radius: radius, fill: fill),
      )
    }
  },
  header-ascent: 12%,
  margin: (top: 30%, bottom: 10%),
  height: 11in,
  width: 8.5in,
)

#let answer_box(i, layout) = {
  // Rounded corners box.
  box(
    width: 100% * layout.width,
    height: 0.55in,
    stroke: 1pt,
    radius: 5pt,
    [
      // Two column grid with a dividing line.
      #gridx(
        columns: (0.5in, 1fr),
        rows: 1fr,
        [#{
            i + 1
          }.],
        align: center + horizon,
        vlinex(),
        "",
      )
    ],
  )
}

#let problem_count = problems.len()

// Generate boxes and measure them.
#{
  let answer_box_column_count = 3
  columns(
    answer_box_column_count,
    gutter: 11pt,
    range(problem_count)
      .map(i => {
        layout(size => {
          style(styles => {
            let elem = answer_box(i, size)
            [#elem #metadata(measure(elem, styles)) #label("box_" + str(i))]
          })
        })
      })
      .join(),
  )
}

// Returns a proper bounding box.
// Querying location position seems to give bottom right x, y coordinates
// so we correct to give a box instead.
#let calculate_bounding_box((width, height), (page, x, y)) = {
  let top_left = (x - width, y - height)
  (page: page, top_left: top_left, bottom_right: (x, y))
}

// Generate metadata for dividing lines and box positions. (accessible via external query)
#locate(loc => {
  [#metadata(
      range(counter(page).at(loc).first()).map(i => {
        let elem = query(selector(label("header_line_" + str(i))), loc).first()
        calculate_bounding_box(elem.value, elem.location().position())
      }),
    ) #label("header_lines")]
  [#metadata(
      range(problem_count).map(i => {
        let elem = query(selector(label("box_" + str(i))), loc).first()
        calculate_bounding_box(elem.value, elem.location().position())
      }),
    ) #label("box_positions")]
})

// Set page header for problems.
#set page(
  header: [
    #set text(10pt)
    #grid(
      columns: (4em, 8em, 1fr, 12em),
      // Left
      align(
        bottom + left,
        if not is_local {
          move(
            dy: 0.4em,
            image(width: 3em, height: 3em, "/assets/test_logo.png"),
          )
        },
      ), smallcaps("Stanford Math Tournament"),
      // Center
      align(center, [#smallcaps(test_metadata.name)]),
      // Right
      align(right)[#smallcaps(
          datetime(
            day: test_metadata.day,
            month: test_metadata.month,
            year: test_metadata.year,
          ).display("[month repr:long] [day], [year padding:zero repr:full]"),
        )],
    )
    #line(start: (0%, 0%), end: (100%, 0%), stroke: 1pt)
  ],
  footer: none,
  margin: auto,
)

// Typeset problems.
#let macros = (
  (
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
  )
    .pairs()
    .map(pair => {
      let (name, value) = pair
      let (arg_count, body) = value
      "\\newcommand{" + name + "}" + arg_count + "{" + body + "}"
    })
    .join()
)

#let replace_image(latex, convert) = {
  let no_end_brace = `[^\}]`.text
  let image_regex = regex(
    `\\(image|includegraphics)(\[[^\]]*\])*\{(`.text
      + no_end_brace
      + `+)\}`.text,
  )
  latex = latex.replace(
    image_regex,
    (m, ..) => {
      let path = "/problem_images" + m.captures.last()
      "\\iftypst\n #figure(image(\"" + path + "\", height: 150pt))\n\\fi"
    },
  )
  // Super lazy for now, until https://github.com/mitex-rs/mitex/pull/152 is resolved.
  // Regex finitely many nested brace pairs.
  let no_brace = `[^\{\}]`.text
  let brace_pair_list(center_regex) = (
    no_brace + `*(\{`.text + center_regex + `\}`.text + no_brace + `*)*`.text
  )
  let nested_brace_pairs(count) = if count == 1 {
    brace_pair_list(no_brace + "*")
  } else {
    brace_pair_list(nested_brace_pairs(count - 1))
  }
  let boxed_regex = regex(
    `\\(boxed|ans)\{(`.text + nested_brace_pairs(4) + `)\}`.text,
  )
  latex.replace(
    boxed_regex,
    (m, ..) => {
      (
        "\\iftypst#pad(y: 4pt, move(dy: -1pt, box(stroke: 0.5pt, inset: (x: 2pt, y: 6pt), ["
          + mitex-convert(
            mode: "text",
            "$" + m.captures.at(1) + "$",
          )
          + "])))\\fi"
      )
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

#set enum(tight: false)
#enum(
  ..problems
    .enumerate()
    .map(((i, p)) => {
      let p_typst = convert_to_typst(p.problem_latex)
      enum.item([
        #if test_metadata.display.problems {
          eval(p_typst, mode: "markup", scope: mitex-scope)
        }


        #if test_metadata.display.answers {
          [
            *Answer: #eval(convert_to_typst(p.answer_latex), mode: "markup", scope: mitex-scope)*
          ]
        }

        #if test_metadata.display.solutions {
          [
            *Solution:* #eval(convert_to_typst(p.solution_latex), mode: "markup", scope: mitex-scope)
          ]
        }
      ])
    }),
)
