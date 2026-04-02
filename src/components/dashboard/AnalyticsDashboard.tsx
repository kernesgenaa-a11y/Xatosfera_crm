import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const AnalyticsDashboard = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Analytics</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Аналітика перенесена на сторінку "Звіти та Аналітика".
      </CardContent>
    </Card>
  );
};
