# TailorMe

## Team

| Name            | Email                            | UTORid   |
| --------------- | -------------------------------- | -------- |
| Muhammad Bilal  | mb.bilal@mail.utoronto.ca        | bilalm15 |
| Danish Mohammed | danish.mohammed@mail.utoronto.ca | moha2666 |

## Project Overview

TailorMe (publicly accessible at [https://ummahworks.danishmohammed.ca](https://ummahworks.danishmohammed.ca))
is a smart resume tailoring platform designed to help job seekers productively create tailored applications.

Users can upload a master resume, and then paste in a job description. The AI analyzes the job posting and creates a customized resume that includes relevant keywords, experience, and qualifications. Users can re-prompt to suggest further edits, or manually edit the resume themselves. Then, they can export the final resume as PDFs.

TailorMe AI simplifies and elevates the job application process for students, new grads, and professionals aiming to increase their chances of getting noticed by applicant tracking systems (ATS) and recruiters.

## Tech Stack

- **Frontend:** Angular.js

## Additional Requirement

We will implement the requirement: **"A piece of the application uses task queues to process data asynchronously independent of HTTP requests."**

This will be done by integrating a **task queue system** that is triggered when the user clicks the **"Export PDF"** button. After downloading their final resume, a background task will:

- Automatically create a **summary of changes** made by the AI agent.
- Email this summary to the user, along with their job description and final resume for personal bookkeeping purposes.

## Milestones

### Alpha Milestones

- **User Authentication & Payment**: Implement OAuth 2.0 login using Google and integrate Stripe Checkout for monthly subscription enforcement.
- **Resume & Job Description Upload**: Allow users to upload their master resume and paste in a job description. Store them securely in the database.

### Beta Milestones

- **Targeted Resume Editor**: Use an AI agent to generate a custom resume based on the master resume and job description.
- **Edit Interface**: Enable users to re-prompt suggestions or edit their generated resume directly in the browser.

### Final Version

- **Export Features**: Allow users to export tailored resume and cover letter as formatted PDFs.
- **Email Summary**: Once exported, use a background task to generate a summary of the AI-driven edits and email it to the user along with the job description and final exported resume.
