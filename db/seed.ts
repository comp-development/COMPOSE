import { SeedClient, createSeedClient } from "@snaplet/seed";
import { copycat } from "@snaplet/copycat";

async function create_style(seed: SeedClient) {
  await seed.settings([
    {
      id: 1,
      settings: {
        url: "https://compose.stanfordmathtournament.com",
        logo: "https://www.stanfordmathtournament.com/SMT%20White.png",
        title: "COMPOSE Dev Environment",
        styles: {
          primary: "#201c98",
          secondary: "#81706d",
          background: "#FFFBF0",
          "font-family": "Source Sans Pro",
          "primary-dark": "#0f1865",
          "primary-tint": "#d9d8e9",
          "primary-light": "#72ccdc",
          "secondary-dark": "#544545",
          "secondary-tint": "#f2dfdf",
          "background-dark": "#ffd7d7",
          "secondary-light": "#cfaeae",
          "text-color-dark": "#000",
          "text-color-light": "#fff",
        },
        discord: {
          guild_id: "968089252107792444",
          embed_color: "0xdc7291",
          notifs_forum: "1191688676833493033",
          notifs_channel: "1167741704175099955",
          thread_channel: "1167741704175099955",
        },
        progress: {
          goal: 120,
          after: "2024-10-19T20:00:00Z",
          before: "2025-04-12T00:00:00Z",
        },
        constants: {
          white: "#fff",
          return: "#999999",
          unsure: "#FFFB99",
          correct: "#9BFF99",
          incorrect: "#ff9999",
          "return-text": "#282828",
          "unsure-text": "#7C7215",
          "correct-text": "#157C20",
          "incorrect-text": "#AD2828",
        },
        test_logo: "https://i.ibb.co/0XdvxKJ/smt-logo-updated.png",
        description: "The COMPOSE Developer Platform",
        abbreviation: "DME",
      },
    },
  ]);
}

async function create_users(
  seed: SeedClient,
  users: {
    full_name: string;
    email: string;
    encrypted_password: string;
    role: number;
    other_fields: any;
  }[],
) {
  return await seed.public_users(
    users.map((u) => {
      return {
        auth_users: {
          instance_id: "00000000-0000-0000-0000-000000000000",
          aud: "authenticated",
          role: "authenticated",
          email: u.email,
          encrypted_password: u.encrypted_password,
          raw_app_meta_data: {
            provider: "email",
            providers: ["email"],
          },
          raw_user_meta_data: {
            email_verified: false,
            phone_verified: false,
          },
        },
        user_roles: [{ role: u.role }],
        full_name: u.full_name,
        amc_score: 8,
        email: u.email,
        discord_tokens: {
          Hoc: "",
        },
        ...(u.other_fields ?? {}),
      };
    }),
  );
}

async function main() {
  const seed = await createSeedClient({ dryRun: true });

  await create_style(seed);

  const users = [
    {
      full_name: "Thomas Anderson",
      email: "admin@gmail.com",
      encrypted_password:
        "$2a$10$InOOYaBtz1ZvC.VOA1JeCebPS8Eiu1LXtAC4spTrtqLCnrFjnxK5y",
      role: 40,
      other_fields: {
        initials: "TA",
        math_comp_background: "A lot of background",
        discord: "#neo",
      },
    },
    {
      full_name: "Jane PWoe",
      email: "jane@gmail.com",
      encrypted_password:
        "$2a$10$YnDjvmKOFrFBcxIvRwNQeO9EsZaL0Hh.0QhF1Y2f6AVi/hLH4uiLC",
      role: 30,
      other_fields: {
        initials: "JP",
        math_comp_background: "Wrote the Pwoetnam",
        discord: "#jp",
      },
    },
  ];
  const { public_users } = await create_users(seed, users);

  await seed.tournaments([
    {
      tournament_name: "Sample Tournament",
      tournament_date: new Date(),
      archived: false,
      tests: [
        {
          test_name: "Sample Test",
          test_description: "example test",
          is_team: false,
          archived: false,
          test_problems: [
            {
              problems: {
                problem_latex:
                  "Let a $box$ be defined as three natural numbers $x, y, z > 0.$ Compute the number of boxes with volume $x y z$ less than or equal to $4.$",
                answer_latex: "13",
                solution_latex:
                  "3 ones gives 1 combination. 2 ones and 1 two, or 2 ones and 1 three, or 2 ones and 1 four gives 9 combinotions. 1 one and 2 twos gives 3 combinations.",
                difficulty: 1,
                status: "On Test",
                author_id: public_users.find(
                  (u) => u.full_name == "Thomas Anderson",
                )?.id,
              },
            },
          ],
        },
      ],
    },
  ]);

  process.exit();
}

main();
