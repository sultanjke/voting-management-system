import { createApp } from "@/src/app";

const port = Number(process.env.SERVER_PORT ?? process.env.PORT ?? 4000);

const app = createApp();
app.listen(port, () => {
  console.log(`ResidentVote API listening on http://localhost:${port}`);
});
