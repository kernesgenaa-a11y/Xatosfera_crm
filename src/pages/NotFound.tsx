import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { language } = useLanguage();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center px-4">
        <div className="mb-8">
          <h1 className="text-9xl font-bold text-gradient">404</h1>
        </div>
        <h2 className="text-2xl font-semibold text-foreground mb-4">
          {language === 'uk' ? 'Сторінку не знайдено' : 'Page Not Found'}
        </h2>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          {language === 'uk'
            ? 'Схоже, що сторінка, яку ви шукаєте, не існує або була переміщена.'
            : "The page you're looking for doesn't exist or has been moved."}
        </p>
        <div className="flex gap-4 justify-center">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {language === 'uk' ? 'Назад' : 'Go Back'}
          </Button>
          <Button asChild className="gradient-primary">
            <Link to="/dashboard">
              <Home className="mr-2 h-4 w-4" />
              {language === 'uk' ? 'На головну' : 'Home'}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
