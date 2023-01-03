import { CircularProgress } from "@material-ui/core";
import Button from "@material-ui/core/Button";
import { CandyMachine } from "@metaplex-foundation/js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { GatewayStatus, useGateway } from "@civic/solana-gateway-react";
import {
  GuardGroupStates,
  ParsedPricesForUI,
  PaymentRequired,
} from "./hooks/types";

export const CTAButton = styled(Button)`
  display: inline-block !important;
  margin: 10px auto !important;
  background-color: #fff !important;
  color: #000 !important;
  min-width: 258px !important;
  font-size: 1em !important;
  font-family: "Montserrat", cursive;
  font-weight: bold !important;
`;

export const Minus = styled.button`
  font-size: 2em;
  padding: 15px 15px;
  font-weight: bold;
  line-height: 0.5px;
  color: #000;
  background: #fff;
  box-shadow: 0px 3px 5px -1px rgb(0 0 0 / 20%),
    0px 6px 10px 0px rgb(0 0 0 / 14%), 0px 1px 18px 0px rgb(0 0 0 / 12%);
  border: 0;
  border-radius: 5px;
  box-sizing: border-box;
  font-family: "Montserrat", cursive;
  vertical-align: middle;
  transition: all linear 0.3s;

  :hover {
    border: none;
    outline: none !important;
    background: #bb80fe;
  }
  :not(disabled) {
    cursor: pointer;
  }

  :not(disabled):hover {
    outline: 1px solid var(--title-text-color);
  }
`;

export const Plus = styled(Minus)`
  margin-left: 0;
`;

export const NumericField = styled.input`
  font-size: 2em !important;
  padding: 0;
  vertical-align: middle;
  background-color: var(--main-text-color);
  box-shadow: 0px 3px 5px -1px rgb(0 0 0 / 20%),
    0px 6px 10px 0px rgb(0 0 0 / 14%), 0px 1px 18px 0px rgb(0 0 0 / 12%);
  box-sizing: border-box;
  font-family: "Montserrat", cursive;
  font-weight: 500;
  line-height: 1px;
  border: none;
  text-align: center;
  border-radius: 5px;
  transition: all 0.4s ease;
  -moz-appearance: textfield;
  -webkit-appearance: none;
  margin: 0 10px;

  :hover,
  :focus {
    box-shadow: 0px 3px 5px -1px rgb(0 0 0 / 40%),
      0px 6px 10px 0px rgb(0 0 0 / 34%), 0px 1px 18px 0px rgb(0 0 0 / 32%);
  }

  ::-webkit-outer-spin-button,
  ::-webkit-inner-spin-button {
    -webkit-appearance: none;
  }
`;
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}
const deepClone = (items: PaymentRequired[]) =>
  items.map((item) => ({ ...item }));
export const MultiMintButton = ({
  onMint,
  candyMachine,
  isMinting,
  setIsMinting,
  isEnded,
  isActive,
  isSoldOut,
  prices,
  guardStates,
  gatekeeperNetwork,
}: {
  onMint: (quantityString: number) => Promise<void>;
  candyMachine: CandyMachine | undefined;
  isMinting: boolean;
  setIsMinting: (val: boolean) => void;
  isEnded: boolean;
  isActive: boolean;
  isSoldOut: boolean;
  prices: ParsedPricesForUI;
  guardStates: GuardGroupStates;
  gatekeeperNetwork?: PublicKey;
}) => {
  const [loading, setLoading] = useState(false);

  const [mintCount, setMintCount] = useState(1);
  const { requestGatewayToken, gatewayStatus } = useGateway();
  const [waitForActiveToken, setWaitForActiveToken] = useState(false);
  const limit = useMemo(() => guardStates.canPayFor, [guardStates]);

  const totalSolCost = useMemo(
    () =>
      prices
        ? mintCount *
          (prices.payment
            .filter(({ kind }) => kind === "sol")
            .reduce((a, { price }) => a + price, 0) +
            0.012)
        : 0.012,
    [mintCount, prices]
  );
  const totalTokenCosts = useMemo((): PaymentRequired[] => {
    if (!prices) return [];
    const maxPriceHash: { [k: string]: number } = {};
    const payment$burn$lenth = prices.payment.length + prices.burn.length;
    let payments = deepClone(
      prices.payment.concat(prices.burn).concat(prices.gate)
    ).filter((price, index) => {
      const cacheKey = price.mint?.toString();
      if (!["token", "nft"].includes(price.kind)) return false;
      const alreadyFound = !!maxPriceHash[cacheKey];
      if (index < payment$burn$lenth) price.price *= mintCount;
      price.price = maxPriceHash[cacheKey] = Math.max(
        maxPriceHash[cacheKey] || 0,
        price.price
      );
      return !alreadyFound;
    });
    return payments;
  }, [mintCount, prices]);
  const totalTokenCostsString = useMemo(() => {
    return totalTokenCosts.reduce(
      (text, price) => `${text} + ${price.price} $BONK ${price.label}`,
      ""
    );
  }, [totalTokenCosts]);

  const previousGatewayStatus = usePrevious(gatewayStatus);
  useEffect(() => {
    const fromStates = [
      GatewayStatus.NOT_REQUESTED,
      GatewayStatus.REFRESH_TOKEN_REQUIRED,
    ];
    const invalidToStates = [...fromStates, GatewayStatus.UNKNOWN];
    if (
      fromStates.find((state) => previousGatewayStatus === state) &&
      !invalidToStates.find((state) => gatewayStatus === state)
    ) {
      setIsMinting(true);
    }
    // console.log("change: ", GatewayStatus[gatewayStatus]);
  }, [previousGatewayStatus, gatewayStatus, setIsMinting]);

  useEffect(() => {
    if (waitForActiveToken && gatewayStatus === GatewayStatus.ACTIVE) {
      console.log("Minting after token active");
      setWaitForActiveToken(false);
      onMint(mintCount);
    }
  }, [waitForActiveToken, gatewayStatus, onMint, mintCount]);

  const incrementValue = useCallback(() => {
    setMintCount((value) => {
      // if (value < 10) return value + 1;
      return Math.min(value + 1, limit);
    });
  }, [limit]);

  const decrementValue = useCallback(() => {
    setMintCount((value) => {
      if (value > 1) return value - 1;
      return value;
    });
  }, []);

  const updateMintCount = useCallback(
    (event: any) => {
      var value = parseInt(event.target.value) || 0;
      setMintCount(Math.max(Math.min(value, limit), 1));
    },
    [limit]
  );

  const disabled = useMemo(
    () =>
      loading ||
      isSoldOut ||
      isMinting ||
      isEnded ||
      !isActive ||
      mintCount > limit,
    [loading, isSoldOut, isMinting, isEnded, !isActive]
  );
  return (
    <div>
      <div>
        <Minus disabled={disabled || mintCount <= 1} onClick={decrementValue}>
          <span style={{ marginTop: "-5px !important" }}>-</span>
        </Minus>
        <NumericField
          disabled={disabled}
          type="number"
          className="mint-qty"
          step={1}
          min={1}
          max={Math.min(limit, 10)}
          value={mintCount}
          onChange={updateMintCount}
        />
        <Plus
          disabled={disabled || limit <= mintCount}
          onClick={incrementValue}
        >
          +
        </Plus>

        <br />
        <CTAButton
          disabled={disabled}
          onClick={async () => {
            console.log("isActive gatekeeperNetwork", {
              isActive,
              gatekeeperNetwork,
            });
            if (isActive && gatekeeperNetwork) {
              if (gatewayStatus === GatewayStatus.ACTIVE) {
                await onMint(mintCount);
              } else {
                setWaitForActiveToken(true);
                await requestGatewayToken();
              }
            } else {
              await onMint(mintCount);
            }
          }}
          variant="contained"
        >
          {!candyMachine ? (
            "CONNECTING..."
          ) : isSoldOut ? (
            "SOLD OUT"
          ) : isActive ? (
            guardStates.messages.length ? (
              guardStates.messages[0]
            ) : mintCount > limit ? (
              "LIMIT REACHED"
            ) : isMinting || loading ? (
              <CircularProgress />
            ) : (
              "MINT"
            )
          ) : isEnded ? (
            "ENDED"
          ) : (
            "UNAVAILABLE"
          )}
        </CTAButton>
      </div>
      {!isSoldOut && isActive && (
        <h3>
          Total estimated cost (Solana fees included): {totalSolCost} SOL
          {totalTokenCostsString}
        </h3>
      )}
      {guardStates.messages?.map((m, i) => (
        <p key={i}>{m}</p>
      ))}
    </div>
  );
};
