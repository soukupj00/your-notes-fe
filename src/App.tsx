import Layout from '@/components/layout.tsx';
import { Button } from '@/components/ui/button.tsx';
import { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);

  return (
    <Layout>
      <Button title="Text For Button" onClick={() => setCount((count) => count + 1)}>
        count is {count}
      </Button>
    </Layout>
  );
}

export default App;
