import type { Metadata } from 'next';
import { TrainerApp } from '@/components/TrainerApp';

export const metadata: Metadata = {
  title: 'The board — Mechatronic Trainer',
  description: 'Wire the trainer board: run leads between terminals and watch the relay logic run.',
};

export default function Page() {
  return <TrainerApp />;
}
