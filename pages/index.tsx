import React, { useState } from "react";
import { GetServerSideProps } from "next";
import { useQRCode } from "next-qrcode";
import Countdown, { CountdownRenderProps } from "react-countdown";
import { getCookie } from "cookies-next";

import { useToast } from "@/src/context/ToastContext";
import { useModal } from "@/src/context/ModalContext";
import { useCopyToClipboard, useLocalStorage } from "@/src/hooks";
import ErrorBoundary from "@/src/components/ErrorBoundary";

import {
  BASE_URL,
  PRODUCTION_SITE_URL,
  URL_REGEX,
  selfDestructDurations,
} from "@/src/constants";
import { URLData, URLDataNextAPI } from "@/src/interfaces";

import LoadingIcon from "@/src/components/Icons/LoadingIcon";
import ClipboardIcon from "@/src/components/Icons/ClipboardIcon";
import QRCodeIcon from "@/src/components/Icons/QRCodeIcon";
import GitHubLink from "@/src/components/Icons/GitHubLink";
import TrashIcon from "@/src/components/Icons/TrashIcon";
import ChevronIcon from "@/src/components/Icons/ChevronIcon";

const ClientOnly = React.lazy(() =>
  import("@/src/components/ClientOnly").then((module) => ({
    default: module.ClientOnly,
  }))
);

interface HomeProps {
  userUrls: URLData[];
}

export const Home: React.FC<HomeProps> = ({ userUrls }) => {
  const [urlData, setUrlData] = useLocalStorage<URLData[]>("urls", userUrls);
  const [destinationUrl, setDestinationUrl] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<string | number>("");
  const [urlsInDeletionProgress, setUrlsInDeletionProgress] = useState<
    { id: string; deleted: boolean; deleting: boolean }[]
  >([]);

  const { dispatchToast } = useToast();
  const { dispatchModal } = useModal();
  const [, copy] = useCopyToClipboard();
  const { Canvas: QRCodeCanvas } = useQRCode();

  React.useEffect(() => {
    setUrlData(userUrls);
  }, []);

  const handleCreateShortURL = async () => {
    if (destinationUrl.trim() === "") {
      dispatchToast("Please enter in a URL", "warning", 5000);
      return;
    } else if (!URL_REGEX.test(destinationUrl)) {
      dispatchToast("This is not a vaid URL", "danger", 5000);
      return;
    }
    const productionSiteUrled = new URL(PRODUCTION_SITE_URL);
    const destinationSiteUrled = new URL(destinationUrl);
    if (productionSiteUrled.hostname === destinationSiteUrled.hostname) {
      dispatchToast("You cannot shorten this domain", "warning", 5000);
      return;
    }
    const alreadyCreated = Array.isArray(urlData)
      ? urlData.filter((urlItem) => urlItem.destination === destinationUrl)
      : [];
    if (alreadyCreated.length) {
      dispatchToast("Link already created", "warning");
      return;
    }
    if (isLoading) return;
    setIsLoading(true);

    const url = selectedDuration
      ? `/api/urls?destination=${destinationUrl}&self_destruct=${selectedDuration}`
      : `/api/urls?destination=${destinationUrl}`;
    const response = await fetch(url, {
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify({
        password,
      }),
    });
    const result: URLDataNextAPI = await response.json();
    const data = result?.result as URLData;

    if (result?.error) {
      const toastText =
        typeof result.error === "string"
          ? result.error
          : "Creating Short URL Error";
      dispatchToast(toastText, "danger", 7000);
      console.error("Creating Short URL Error:", result.error);
      setIsLoading(false);
    } else if (data) {
      const BASE_URL =
        process.env.NODE_ENV === "production"
          ? "https://nolongr.vercel.app"
          : "http://localhost:3000";
      const newUrlData: URLData = {
        date_created: data.date_created,
        destination: data.destination,
        id: data.id,
        url: `${BASE_URL}/${data.id}`,
        self_destruct: data.self_destruct,
      };
      setUrlData([newUrlData, ...(urlData ?? [])]);
      setIsLoading(false);
    }
  };

  const handleClickCreateShortURL = (
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    e.preventDefault();
    handleCreateShortURL();
  };

  const handleKeyDownCreateShortURL = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Enter") {
      handleCreateShortURL();
    }
  };

  const handleChangeDestinationUrl = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    setDestinationUrl(value);
  };

  const handleChangePassword = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
  };

  const handleCopyUrl = async (urlItem: URLData) => {
    const url = urlItem.url;
    if (url) {
      const result = await copy(url);
      result && dispatchToast("Successfully copied to clipboard", "copy");
    }
  };

  const handleOpenQRCodeModal = (urlItem: URLData) => {
    dispatchModal(
      "QR Code",
      <div className="flex items-center justify-center text-black p-4">
        <QRCodeCanvas text={urlItem.url} options={{ width: 300 }} />
      </div>
    );
  };

  const handleDeleteShortUrl = async (
    selectedUrlItem: URLData,
    disabled: boolean
  ) => {
    if (disabled) return;

    const newUrlInDeletionProgress = {
      id: selectedUrlItem.id,
      deleted: false,
      deleting: true,
    };
    setUrlsInDeletionProgress([
      ...urlsInDeletionProgress,
      newUrlInDeletionProgress,
    ]);
    const sessionToken = getCookie("session_token");
    const url = sessionToken
      ? `/api/delete-url?id=${selectedUrlItem.id}&session_token=${sessionToken}`
      : `/api/delete-url?id=${selectedUrlItem.id}`;
    const response = await fetch(url, {
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "DELETE",
    });
    const result: URLDataNextAPI = await response.json();
    const data = result?.result as URLData;
    if (data) {
      const newUrlsInDeletionProgress = urlsInDeletionProgress.filter(
        (url) => url.deleted === true
      );

      const newUrlInDeletionProgress = {
        id: selectedUrlItem.id,
        deleted: true,
        deleting: false,
      };
      setUrlsInDeletionProgress([
        ...newUrlsInDeletionProgress,
        newUrlInDeletionProgress,
      ]);

      const result = urlData.filter((urlItem) => {
        if (selectedUrlItem.id === urlItem.id) return false;
        const found = urlsInDeletionProgress.find(
          (url) => url.id === urlItem.id
        );
        return found?.id !== urlItem.id;
      });
      setUrlData(result);
    }
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDuration = e.target.value;
    setSelectedDuration(newDuration);
  };

  const handleToggleShowAdvanced = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setShowAdvanced(!showAdvanced);
  };

  return (
    <main className="relative min-h-screen flex flex-col items-center p-2 bg-brand-green-200 pt-32">
      <h1 className="text-white text-4xl uppercase mb-5 font-bold">
        URL Shortener
      </h1>
      <div className="items-center justify-center rounded-sm w-full md:max-w-xl p-6 bg-brand-green-300 shadow">
        <form className="flex flex-col items-center justify-center w-full">
          <label
            className="mr-2 text-black mb-2 text-xl uppercase font-semibold text-brand-dark-green-200"
            htmlFor="url"
          >
            Shorten a long URL
          </label>
          <span className="flex flex-wrap md:flex-nowrap rounded-sm overflow-hidden block w-full">
            <div className="w-full relative">
              <ErrorBoundary name="url-input">
                <input
                  className="caret-zinc-900 h-12 py-2 px-3 bg-white text-gray-600 w-full focus:outline-none placeholder:text-gray-400"
                  value={destinationUrl}
                  onChange={handleChangeDestinationUrl}
                  onKeyDown={handleKeyDownCreateShortURL}
                  id="url"
                  placeholder="Paste a link here"
                />
              </ErrorBoundary>
            </div>
            <button
              className="flex items-center justify-center text-brand-dark-green-100 rounded-r-sm px-2 whitespace-nowrap h-12 w-full md:w-44 mt-2 md:mt-0 font-bold bg-brand-neon-green-100 hover:bg-brand-neon-green-200 disabled:bg-brand-neon-green-100 duration-200"
              onClick={handleClickCreateShortURL}
              disabled={isLoading}
            >
              {isLoading && (
                <span className="mr-2">
                  <LoadingIcon />
                </span>
              )}
              {isLoading ? "Loading..." : "Shorten URL"}
            </button>
          </span>
          <div className="mt-2 w-full">
            <button
              className="bg-brand-grayish-green-300 text-white w-32 px-2 py-0.5 rounded-sm flex items-center justify-between"
              onClick={handleToggleShowAdvanced}
            >
              Advanced
              <span className={showAdvanced ? "rotate-180" : undefined}>
                <ChevronIcon />
              </span>
            </button>
            {showAdvanced && (
              <div className="w-full flex flex-col sm:flex-row mt-2 gap-2">
                <div className="text-black">
                  <select
                    id="durations"
                    onChange={handleDurationChange}
                    className="bg-gray-50 px-2 w-full sm:w-40 h-8 border border-gray-300 text-gray-900 text-sm rounded-sm focus:ring-blue-500 focus:border-blue-500 block"
                  >
                    {selfDestructDurations.map((duration) => (
                      <option key={duration.label} value={duration.value}>
                        {duration.label}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  className="h-8 py-2 px-3 bg-white rounded-sm text-gray-600 w-full focus:outline-none placeholder:text-gray-400"
                  value={password}
                  onChange={handleChangePassword}
                  id="password"
                  type="password"
                  placeholder="Password"
                />
              </div>
            )}
          </div>
        </form>
        {Array.isArray(urlData) &&
          urlData.length > 0 &&
          urlData.map((urlItem) => {
            const isTryingToDelete = Boolean(
              urlsInDeletionProgress.find((url) => {
                return url.id === urlItem.id && url.deleting === true;
              })
            );
            return (
              <ErrorBoundary name="url-list" key={urlItem.id}>
                <div className="flex mt-2">
                  <div className="result-box flex w-full bg-brand-grayish-green-200 rounded-sm">
                    <div className="flex flex-col w-full p-2">
                      <span>
                        <span className="mr-1.5">Click to visit:</span>
                        <a
                          className="text-brand-neon-green-100 break-all font-semibold"
                          href={urlItem.url}
                          target="_blank"
                        >
                          {urlItem.url}
                        </a>
                      </span>
                      <span className="flex">
                        <span className="mr-1.5">Destination:</span>
                        <input
                          className="break-all w-full px-1 bg-brand-green-400 text-gray-500 rounded-sm"
                          defaultValue={urlItem.destination}
                          disabled={true}
                        />
                      </span>
                      {urlItem.self_destruct && (
                        <span className="flex">
                          <React.Suspense>
                            <ClientOnly>
                              <Countdown
                                date={new Date(urlItem.self_destruct)}
                                intervalDelay={0}
                                renderer={CountdownRenderer}
                              />
                            </ClientOnly>
                          </React.Suspense>
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 w-16 min-w-[5rem] max-w-[5rem] items-center justify-between ml-auto border-l border-brand-grayish-green-100 p-2">
                      <button
                        onClick={() => handleCopyUrl(urlItem)}
                        title="Copy to clipboard"
                      >
                        <ClipboardIcon />
                      </button>
                      <button
                        onClick={() => handleOpenQRCodeModal(urlItem)}
                        title="Show QR Code"
                      >
                        <QRCodeIcon />
                      </button>
                    </div>
                  </div>
                  <button
                    className="ml-1.5 px-1 bg-light-danger hover:bg-red-500"
                    disabled={isTryingToDelete}
                    onClick={() =>
                      handleDeleteShortUrl(urlItem, isTryingToDelete)
                    }
                  >
                    {isTryingToDelete ? <LoadingIcon /> : <TrashIcon />}
                  </button>
                </div>
              </ErrorBoundary>
            );
          })}
        <p className="mt-2 text-brand-dark-green-100">
          Experience the magically URL shortening powers of{" "}
          <span className="font-bold">NoLongr</span>. This tool will help you to
          create shortened links, making it easier than ever to share and
          engage. Enjoy the convenience of quick and concise links that are easy
          to share.
        </p>
      </div>
      <GitHubLink />
    </main>
  );
};

export default Home;

const CountdownRenderer: React.FC<CountdownRenderProps> = ({
  hours,
  minutes,
  seconds,
  completed,
}) => {
  if (completed) {
    return (
      <span className="bg-red-error-text text-sm px-2 rounded">Expired</span>
    );
  } else {
    const _hours = String(hours).length === 1 ? `0${hours}` : hours;
    const _minutes = String(minutes).length === 1 ? `0${minutes}` : minutes;
    const _seconds = String(seconds).length === 1 ? `0${seconds}` : seconds;
    return (
      <div className="flex">
        <span className="mr-1.5">Expires in:</span>
        <span>
          {_hours}:{_minutes}:{_seconds}
        </span>
      </div>
    );
  }
};

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const sessionToken = req.cookies["session_token"];

  if (sessionToken) {
    const url = `${BASE_URL}/user-session-urls?session_token=${sessionToken}`;

    const urlDataRequest = await fetch(url, {
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "GET",
    });

    const urlDataResponse = await urlDataRequest.json();

    const result = urlDataResponse?.result;

    const props: HomeProps = {
      userUrls: Array.isArray(result) ? result : [],
    };

    return {
      props,
    };
  }
  return { props: {} };
};

import { useEffect } from "react";

export function useDebounce<T>(value: T, delay?: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay || 500);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
