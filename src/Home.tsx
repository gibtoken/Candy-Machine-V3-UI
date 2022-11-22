import { useCallback } from "react";
import { Paper, Snackbar } from "@material-ui/core";
import Alert from "@material-ui/lab/Alert";
import { DefaultCandyGuardRouteSettings, Nft } from "@metaplex-foundation/js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import confetti from "canvas-confetti";
import Link from "next/link";
import Countdown from "react-countdown";

import { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { GatewayProvider } from "@civic/solana-gateway-react";
import { defaultGuardGroup, network, ownerId } from "./config";

import { MultiMintButton } from "./MultiMintButton";

import { AlertState } from "./utils";
import NftsModal from "./NftsModal";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import useCandyMachineV3 from "./hooks/useCandyMachineV3";
import {
  CustomCandyGuardMintSettings,
  NftPaymentMintSettings,
  ParsedPricesForUI,
} from "./hooks/types";
import { guardToLimitUtil } from "./hooks/utils";
import MintGroup from "./components/MintGroup";
import mintGroups from "./constants/mintGroups.json";

import logo from "./resources/logo.png";
import solanastudiologo from "./resources/solanastudio.webp";
import flip from "./resources/flip-3.jpg";
import Image from "next/image";

import { Space, Layout, Card, Col, Row, Divider, Button } from "antd";
import { TwitterOutlined } from "@ant-design/icons";
const { Header, Footer, Sider, Content } = Layout;

// const Header = styled.div`
//   display: flex;
//   justify-content: flex-end;
//   align-items: center;
// `;
const WalletContainer = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: right;
  margin: 10px;
  z-index: 999;
  position: relative;

  .wallet-adapter-dropdown-list {
    background: #ffffff;
  }
  .wallet-adapter-dropdown-list-item {
    background: #000000;
  }
  .wallet-adapter-dropdown-list {
    grid-row-gap: 5px;
  }
`;

const WalletAmount = styled.div`
  color: black;
  width: auto;
  padding: 5px 5px 5px 16px;
  min-width: 48px;
  min-height: auto;
  border-radius: 5px;
  background-color: #85b1e2;
  box-shadow: 0px 3px 5px -1px rgb(0 0 0 / 20%),
    0px 6px 10px 0px rgb(0 0 0 / 14%), 0px 1px 18px 0px rgb(0 0 0 / 12%);
  box-sizing: border-box;
  transition: background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,
    box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,
    border 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms;
  font-weight: 500;
  line-height: 1.75;
  text-transform: uppercase;
  border: 0;
  margin: 0;
  display: inline-flex;
  outline: 0;
  position: relative;
  align-items: center;
  user-select: none;
  vertical-align: middle;
  justify-content: flex-start;
  gap: 10px;
`;

const Wallet = styled.ul`
  flex: 0 0 auto;
  margin: 0;
  padding: 0;
`;

const ConnectButton = styled(WalletMultiButton)`
  border-radius: 5px !important;
  padding: 6px 16px;
  background-color: #fff;
  color: #000;
  margin: 0 auto;
`;

// const Card = styled(Paper)`
//   display: inline-block;
//   background-color: var(--countdown-background-color) !important;
//   margin: 5px;
//   min-width: 40px;
//   padding: 24px;
//   h1 {
//     margin: 0px;
//   }
// `;

export interface HomeProps {
  candyMachineId: PublicKey;
}
const candyMachinOps = {
  allowLists: [
    {
      list: require("../cmv3-demo-initialization/allowlist.json"),
      groupLabel: "OGs",
    },
    {
      list: require("../cmv3-demo-initialization/wl1allowlist.json"),
      groupLabel: "WL1",
    },
  ],
};
const Home = (props: HomeProps) => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const candyMachineV3 = useCandyMachineV3(
    props.candyMachineId,
    candyMachinOps
  );

  const [balance, setBalance] = useState<number>();
  const [mintedItems, setMintedItems] = useState<Nft[]>();

  const [alertState, setAlertState] = useState<AlertState>({
    open: false,
    message: "",
    severity: undefined,
  });

  const { guardLabel, guards, guardStates, prices } = useMemo(() => {
    const guardLabel = defaultGuardGroup;
    return {
      guardLabel,
      guards:
        candyMachineV3.guards[guardLabel] ||
        candyMachineV3.guards.default ||
        {},
      guardStates: candyMachineV3.guardStates[guardLabel] ||
        candyMachineV3.guardStates.default || {
          isStarted: true,
          isEnded: false,
          isLimitReached: false,
          canPayFor: 10,
          messages: [],
          isWalletWhitelisted: true,
          hasGatekeeper: false,
        },
      prices: candyMachineV3.prices[guardLabel] ||
        candyMachineV3.prices.default || {
          payment: [],
          burn: [],
          gate: [],
        },
    };
  }, [
    candyMachineV3.guards,
    candyMachineV3.guardStates,
    candyMachineV3.prices,
  ]);
  useEffect(() => {
    console.log({ guardLabel, guards, guardStates, prices });
  }, [guardLabel, guards, guardStates, prices]);
  useEffect(() => {
    (async () => {
      if (wallet?.publicKey) {
        const balance = await connection.getBalance(wallet.publicKey);
        setBalance(balance / LAMPORTS_PER_SOL);
      }
    })();
  }, [wallet, connection]);

  useEffect(() => {
    if (mintedItems?.length === 0) throwConfetti();
  }, [mintedItems]);

  const openOnSolscan = useCallback((mint) => {
    window.open(
      `https://solscan.io/address/${mint}${
        [WalletAdapterNetwork.Devnet, WalletAdapterNetwork.Testnet].includes(
          network
        )
          ? `?cluster=${network}`
          : ""
      }`
    );
  }, []);

  const throwConfetti = useCallback(() => {
    confetti({
      particleCount: 400,
      spread: 70,
      origin: { y: 0.6 },
    });
  }, [confetti]);

  const startMint = useCallback(
    async (quantityString: number = 1) => {
      const nftGuards: NftPaymentMintSettings[] = Array(quantityString)
        .fill(undefined)
        .map((_, i) => {
          return {
            burn: guards.burn?.nfts?.length
              ? {
                  mint: guards.burn.nfts[i]?.mintAddress,
                }
              : undefined,
            payment: guards.payment?.nfts?.length
              ? {
                  mint: guards.payment.nfts[i]?.mintAddress,
                }
              : undefined,
            gate: guards.gate?.nfts?.length
              ? {
                  mint: guards.gate.nfts[i]?.mintAddress,
                }
              : undefined,
          };
        });

      console.log({ nftGuards });
      // debugger;
      candyMachineV3
        .mint(quantityString, {
          groupLabel: guardLabel,
          nftGuards,
        })
        .then((items) => {
          setMintedItems(items as any);
        })
        .catch((e) =>
          setAlertState({
            open: true,
            message: e.message,
            severity: "error",
          })
        );
    },
    [candyMachineV3.mint, guards]
  );

  useEffect(() => {
    console.log({ candyMachine: candyMachineV3.candyMachine });
  }, [candyMachineV3.candyMachine]);

  const MintButton = ({
    gatekeeperNetwork,
  }: {
    gatekeeperNetwork?: PublicKey;
  }) => (
    <MultiMintButton
      candyMachine={candyMachineV3.candyMachine}
      gatekeeperNetwork={gatekeeperNetwork}
      isMinting={candyMachineV3.status.minting}
      setIsMinting={() => {}}
      isActive={!!candyMachineV3.items.remaining}
      isEnded={guardStates.isEnded}
      isSoldOut={!candyMachineV3.items.remaining}
      guardStates={guardStates}
      onMint={startMint}
      prices={prices}
    />
  );

  return (
    <main className="content">
      <>
        <br />
        <Header style={{ margin: "10px" }}>
          <Space>
            {/* <Image
              src={flip}
              alt="FLiP"
              className="logo"
              width={200}
              height={200}
              style={{ borderRadius: "100px", minWidth: "50px" }}
            /> */}
            <a
              href="https://linktr.ee/flip4funds"
              target="_blank"
              rel="noreferrer"
              title="https://linktr.ee/flip4funds"
            >
              <Image
                src={logo}
                alt="FLiP"
                className="logo"
                width={200}
                height={200}
                style={{ borderRadius: "100px", minWidth: "50px" }}
              />
            </a>
            <WalletContainer>
              <Wallet>
                {wallet ? (
                  <WalletAmount>
                    {(balance || 0).toLocaleString()} SOL
                    <ConnectButton />
                  </WalletAmount>
                ) : (
                  <ConnectButton>Connect Wallet</ConnectButton>
                )}
              </Wallet>
            </WalletContainer>
          </Space>
        </Header>

        <Row>
          {wallet.publicKey?.toBase58() == ownerId.toBase58()
            ? mintGroups.map((x, key) => (
                <Col xs={24} xl={8} key={key} >
                  <Card
                    key={key}
                    style={{
                      padding: "0px",
                      borderRadius: "10px",
                      backgroundColor: "rgba(255,255,255,0.5)",
                      minWidth: 305,
                      width: "45vmin",
                      margin: 10,
                    }}
                  >
                    {x.title ? (
                      <h2
                        style={{
                          color: "black",
                        }}
                      >
                        {x.title}
                      </h2>
                    ) : null}
                    {x.description ? <p>{x.description}</p> : null}
                    {x.groups.map((y, k) => (
                      <MintGroup
                        mintGroup={y}
                        key={k}
                        candyMachineV3={candyMachineV3}
                      />
                    ))}
                  </Card>
                </Col>
              ))
            : mintGroups
                .filter((owner) => owner.title !== "Owners")
                .map((x, key) => (
                  <Col xs={24} xl={8} key={key}>
                    <Card
                      key={key}
                      style={{
                        padding: "0px",
                        borderRadius: "10px",
                        backgroundColor: "rgba(255,255,255,0.5)",
                        minWidth: 305,
                        width: "45vmin",
                        margin: 10,
                        marginLeft: 20,
                      }}
                    >
                      {x.title ? (
                        <h2
                          style={{
                            color: "black",
                          }}
                        >
                          {x.title}
                        </h2>
                      ) : null}
                      {x.description ? (
                        <p
                          style={{
                            color: "black",
                          }}
                        >
                          {x.description}
                        </p>
                      ) : null}
                      {x.groups.map((y, k) => (
                        <MintGroup
                          mintGroup={y}
                          key={k}
                          candyMachineV3={candyMachineV3}
                        />
                      ))}
                    </Card>
                  </Col>
                ))}
        </Row>
        <br />
        <NftsModal
          openOnSolscan={openOnSolscan}
          mintedItems={mintedItems || []}
          setMintedItems={setMintedItems}
        />
        <br />
        <Space style={{ margin: "10px", marginLeft: 20 }}>
          <a
            href="https://solanastudio.xyz/"
            target="_blank"
            rel="noreferrer"
            title="https://solanastudio.xyz"
          >
            <Image src={solanastudiologo} width={100} height={100} />
          </a>
          <span
            style={{
              fontSize: "1.6em",
              fontFamily: "Montserrat",
              marginRight: "10px",
            }}
          >
            Solana Studio
          </span>

          <a href="https://twitter.com/TheStudioSolana" target="_blank" rel="noreferrer" title="Twitter">
            <TwitterOutlined style={{ fontSize: "1.6em", color: "white" }} />
          </a>
        </Space>
      </>
      <Snackbar
        open={alertState.open}
        autoHideDuration={6000}
        onClose={() => setAlertState({ ...alertState, open: false })}
      >
        <Alert
          onClose={() => setAlertState({ ...alertState, open: false })}
          severity={alertState.severity}
        >
          {alertState.message}
        </Alert>
      </Snackbar>
    </main>
  );
};

export default Home;

const renderGoLiveDateCounter = ({ days, hours, minutes, seconds }: any) => {
  return (
    <div>
      <Card >
        <h1>{days}</h1>Days
      </Card>
      <Card>
        <h1>{hours}</h1>
        Hours
      </Card>
      <Card>
        <h1>{minutes}</h1>Mins
      </Card>
      <Card>
        <h1>{seconds}</h1>Secs
      </Card>
    </div>
  );
};
