import { useState } from "react";
import bcrypt from "bcryptjs";
import { GetServerSideProps } from "next/types";

import { BASE_URL } from "@/src/constants";
import { URLDataResponse } from "@/src/interfaces";
import ErrorBoundary from "@/src/components/ErrorBoundary";
import LoadingIcon from "@/src/components/Icons/LoadingIcon";

interface RedirectPageProps {
  hashedPassword: string;
  redirectionUrl: string;
}

export const RedirectPage: React.FC<RedirectPageProps> = ({
  hashedPassword,
  redirectionUrl,
}) => {
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleChangePassword = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (error) {
      setError(null);
    }
    const value = e.target.value;
    setPassword(value);
  };

  const handleCheckPassword = async () => {
    setIsLoading(true);
    if (redirectionUrl && password.trim()) {
      const isSame = await bcrypt.compare(password, hashedPassword);
      if (isSame) {
        window.location.href = redirectionUrl;
      } else {
        setError("Wrong password");
        setIsLoading(false);
      }
    }
  };

  const handleClickCheckPassword = (
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    e.preventDefault();
    handleCheckPassword();
  };

  const handleKeyDownCheckPassword = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    e.preventDefault();
    if (e.key === "Enter") {
      handleCheckPassword();
    }
  };

  return (
    <main className="relative min-h-screen flex flex-col items-center p-2 bg-brand-green-200 pt-32">
      <h1 className="mb-2 text-3xl font-bold text-white">Password</h1>
      <form className="flex flex-col items-center justify-center">
        <span className="flex flex-wrap md:flex-nowrap rounded-sm overflow-hidden block w-full">
          <div className="w-full relative">
            <ErrorBoundary name="password-input">
              <input
                className="caret-zinc-900 h-12 py-2 px-3 bg-white text-gray-600 w-full max-w-[30rem] focus:outline-none placeholder:text-gray-400"
                value={password}
                onChange={handleChangePassword}
                onKeyDown={handleKeyDownCheckPassword}
                id="password"
                type="password"
                placeholder="Please enter the password"
              />
            </ErrorBoundary>
          </div>
          <button
            className="flex items-center justify-center text-brand-dark-green-100 rounded-r-sm h-12 w-full md:w-44 mt-2 md:mt-0 font-bold bg-brand-neon-green-100 hover:bg-brand-neon-green-200 disabled:bg-brand-neon-green-100 duration-200"
            onClick={handleClickCheckPassword}
          >
            {isLoading && <LoadingIcon />} {isLoading ? "Loading..." : "Verify"}
          </button>
        </span>
        {error && (
          <span className="error-message text-red-error-text font-semibold w-full mt-1">
            {error}
          </span>
        )}
      </form>
    </main>
  );
};

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  const shortId = query["id"];

  try {
    const url = `${BASE_URL}/urls/${shortId}`;

    const response = await fetch(url);
    const result: URLDataResponse = await response.json();
    const data: URLDataResponse | null = result || null;

    if (!data) {
      return { notFound: true };
    } else if (data && data.error) {
      const error = {
        error: data.error,
        url,
      };
      console.error(`SERVERSIDE [ID] PAGE ERROR: ${shortId}`, error);
      return { notFound: true };
    } else if (data && data.result && data.result.destination) {
      if (data.result.password) {
        const hashedPassword = data.result?.password?.["String"] ?? null;
        return {
          props: {
            hashedPassword,
            redirectionUrl: data.result.destination,
          },
        };
      } else {
        return {
          redirect: {
            destination: data.result.destination,
            permanent: false,
          },
        };
      }
    }
  } catch (err) {
    return { notFound: true };
  }
  return { notFound: true };
};

export default RedirectPage;
