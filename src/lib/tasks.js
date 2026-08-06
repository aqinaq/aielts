// A small bank of exam-style prompts so users don't have to bring their own.
// Prompts stay in English — it is an English exam — while the surrounding
// labels come from the i18n dictionary.

export const TASK_BANK = {
  write: [
    {
      id: 'w-education',
      type: 'IELTS Writing Task 2',
      minutes: 40,
      minWords: 250,
      prompt:
        'Some people believe that university education should be free for everyone, while others argue that students should pay for it themselves. Discuss both views and give your own opinion.',
    },
    {
      id: 'w-remote-work',
      type: 'IELTS Writing Task 2',
      minutes: 40,
      minWords: 250,
      prompt:
        'More companies now allow employees to work from home permanently. Do the advantages of this development outweigh the disadvantages?',
    },
    {
      id: 'w-technology',
      type: 'IELTS Writing Task 2',
      minutes: 40,
      minWords: 250,
      prompt:
        'Children today spend more time on screens than playing outdoors. What are the causes of this, and what measures could be taken to address it?',
    },
    {
      id: 'w-environment',
      type: 'IELTS Writing Task 2',
      minutes: 40,
      minWords: 250,
      prompt:
        'Some argue that protecting the environment is the responsibility of governments rather than individuals. To what extent do you agree or disagree?',
    },
    {
      id: 'w-letter',
      type: 'IELTS Writing Task 1 (General)',
      minutes: 20,
      minWords: 150,
      prompt:
        'You recently stayed at a hotel and were unhappy with the service. Write a letter to the hotel manager. In your letter: explain why you stayed there, describe what went wrong, and say what you would like the manager to do.',
    },
    {
      id: 'w-email',
      type: 'Professional email',
      minutes: 15,
      minWords: 120,
      prompt:
        'Write an email to a client explaining that a project deadline will slip by two weeks, why it happened, and what you are doing about it. Keep a professional, non-defensive tone.',
    },
  ],
  speak: [
    {
      id: 's-hometown',
      type: 'IELTS Speaking Part 2',
      minutes: 2,
      minWords: 180,
      prompt:
        'Describe a place in your hometown that you like to visit. You should say: where it is, how often you go there, what you do there, and explain why you like it. You have 1 minute to prepare and should speak for 1–2 minutes.',
    },
    {
      id: 's-skill',
      type: 'IELTS Speaking Part 2',
      minutes: 2,
      minWords: 180,
      prompt:
        'Describe a skill you would like to learn. You should say: what the skill is, how you would learn it, how long it would take, and explain why you want to learn it.',
    },
    {
      id: 's-decision',
      type: 'IELTS Speaking Part 2',
      minutes: 2,
      minWords: 180,
      prompt:
        'Describe an important decision you have made. You should say: what the decision was, when you made it, who helped you, and explain how you felt about it afterwards.',
    },
    {
      id: 's-part3',
      type: 'IELTS Speaking Part 3',
      minutes: 3,
      minWords: 200,
      prompt:
        'Discuss: Do you think people rely too much on technology to communicate? How has the way people keep in touch changed compared with a generation ago? Give reasons and examples.',
    },
    {
      id: 's-presentation',
      type: 'Presentation opening',
      minutes: 3,
      minWords: 200,
      prompt:
        'Deliver the opening two minutes of a presentation introducing a product or project you know well. State the problem, your solution, and why the audience should care.',
    },
    {
      id: 's-interview',
      type: 'Job interview answer',
      minutes: 2,
      minWords: 160,
      prompt:
        'Answer the interview question: "Tell me about a time you disagreed with a teammate. What did you do?" Structure your answer as situation, action, result.',
    },
  ],
}
