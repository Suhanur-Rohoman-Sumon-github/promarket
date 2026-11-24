import { Outlet } from "react-router-dom";
import { Toaster } from "sonner";
import Navbar from "../pages/shered/Navbar";
import Footer from "../pages/shered/Footer";

const MainLayOut = () => {
  return (
    <div className="container mx-auto lg:px-20 md:px-10 sm:px-5 px-2">
      <Navbar />
      <Outlet />
      <Footer />
      <Toaster richColors position="top-center" />
    </div>
  );
};

export default MainLayOut;
