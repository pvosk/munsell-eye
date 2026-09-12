import SoundLab from "./sound-lab";

export default function SoundLabPage() {
  return (
    <SoundLab
      signIn={
        <a href="/signin-with-chatgpt?return_to=%2Fsound-lab" target="_top">
          Sign in with ChatGPT to sync
        </a>
      }
    />
  );
}
