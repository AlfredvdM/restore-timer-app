import { DoctorProvider } from './contexts/DoctorContext';
import TimerWidget from './components/TimerWidget';

export default function App() {
  return (
    <DoctorProvider>
      <TimerWidget />
    </DoctorProvider>
  );
}
