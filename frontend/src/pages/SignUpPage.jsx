import { motion } from "framer-motion";
import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import BorderAnimatedContainer from "../components/BorderAnimatedContainer";
import { MessageCircleIcon, LockIcon, MailIcon, UserIcon, PhoneIcon, LoaderIcon, SparklesIcon } from "lucide-react";
import { Link } from "react-router";

function SignUpPage() {
  const [formData, setFormData] = useState({ fullName: "", email: "", password: "", phone: "" });
  const { signup, isSigningUp } = useAuthStore();

  const handleSubmit = (e) => {
    e.preventDefault();
    signup(formData);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="flex w-full items-center justify-center p-4">
      <div className="relative h-[650px] w-full max-w-6xl md:h-[800px]">
        <BorderAnimatedContainer>
          <div className="flex w-full flex-col md:flex-row">
            <div className="flex items-center justify-center p-8 md:w-1/2 md:border-r md:border-white/10">
              <div className="w-full max-w-md">
                <div className="mb-8 text-center">
                  <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[color:var(--accent-3)] shadow-lg">
                    <MessageCircleIcon className="size-7" />
                  </div>
                  <h2 className="mb-2 text-2xl font-semibold text-[color:var(--text-primary)]">Create Account</h2>
                  <p className="text-[color:var(--text-muted)]">Join the next-gen messaging experience</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="auth-input-label">Full Name</label>
                    <div className="relative">
                      <UserIcon className="auth-input-icon" />
                      <input type="text" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} className="input pl-10" placeholder="John Doe" />
                    </div>
                  </div>

                  <div>
                    <label className="auth-input-label">Phone Number <span className="text-[10px] font-normal opacity-60">(optional)</span></label>
                    <div className="relative">
                      <PhoneIcon className="auth-input-icon" />
                      <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="input pl-10" placeholder="9876543210" />
                    </div>
                  </div>

                  <div>
                    <label className="auth-input-label">Email</label>
                    <div className="relative">
                      <MailIcon className="auth-input-icon" />
                      <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="input pl-10" placeholder="johndoe@gmail.com" />
                    </div>
                  </div>

                  <div>
                    <label className="auth-input-label">Password</label>
                    <div className="relative">
                      <LockIcon className="auth-input-icon" />
                      <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="input pl-10" placeholder="Enter your password" />
                    </div>
                  </div>

                  <button className="auth-btn" type="submit" disabled={isSigningUp}>
                    {isSigningUp ? <LoaderIcon className="mx-auto h-5 w-5 animate-spin" /> : "Create Account"}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <Link to="/login" className="auth-link">
                    Already have an account? Login
                  </Link>
                </div>
              </div>
            </div>

            <div className="hidden items-center justify-center bg-gradient-to-br from-white/5 to-transparent p-6 md:flex md:w-1/2">
              <div>
                <div className="mb-6 flex justify-center">
                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur-xl">
                    <SparklesIcon className="size-12 text-[color:var(--accent-3)]" />
                  </div>
                </div>
                <h3 className="text-center text-xl font-semibold text-[color:var(--text-primary)]">Start your journey in style</h3>
                <div className="mt-4 flex justify-center gap-3">
                  <span className="auth-badge">Secure</span>
                  <span className="auth-badge">Modern</span>
                  <span className="auth-badge">Premium</span>
                </div>
              </div>
            </div>
          </div>
        </BorderAnimatedContainer>
      </div>
    </motion.div>
  );
}
export default SignUpPage;
