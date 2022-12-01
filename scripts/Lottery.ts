import { ethers } from "hardhat";
import * as readline from "readline";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Lottery, LotteryToken, LotteryToken__factory, Lottery__factory } from "../typechain-types";

let contract: Lottery;
let token: LotteryToken;
let accounts: SignerWithAddress[];

const NAME = "Lottery Token";
const SYMBOL = "LTT";
const BET_RATIO = 5;
const BET_PRICE = ethers.utils.parseEther("1");
const BET_FEE = ethers.utils.parseEther("0.2");

async function main() {
  await initAccounts();
  await initContracts();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  mainMenu(rl);
}

async function initAccounts() {
  accounts = await ethers.getSigners();
}

async function initContracts() {
  const lotteryContractFactroy = new Lottery__factory(accounts[0]);
  contract =  await lotteryContractFactroy.deploy(NAME, SYMBOL, BET_RATIO, BET_PRICE, BET_FEE);
  await contract.deployed();
  const tokenAddress = await contract.paymentToken();
  const lotteryTokenContractFactory = new LotteryToken__factory();
  token = lotteryTokenContractFactory.attach(tokenAddress).connect(ethers.provider);
}

async function mainMenu(rl: readline.Interface) {
  menuOptions(rl);
}

function menuOptions(rl: readline.Interface) {
  rl.question(
    "Select operation: \n Options: \n [0]: Exit \n [1]: Check state \n [2]: Open bets \n [3]: Top up account tokens \n [4]: Bet with account \n [5]: Close bets \n [6]: Check player prize \n [7]: Withdraw \n [8]: Burn tokens \n",
    async (answer: string) => {
      console.log(`Selected: ${answer}\n`);
      const option = Number(answer);
      switch (option) {
        case 0:
          rl.close();
          return;
        case 1:
          await checkState();
          mainMenu(rl);
          break;
        case 2:
          rl.question("Input duration (in seconds)\n", async (duration) => {
            try {
              await openBets(duration);
            } catch (error) {
              console.log("error\n");
              console.log({ error });
            }
            mainMenu(rl);
          });
          break;
        case 3:
          rl.question("What account (index) to use?\n", async (index) => {
            await displayBalance(index);
            rl.question("Buy how many tokens?\n", async (amount) => {
              try {
                await buyTokens(index, amount);
                await displayBalance(index);
                await displayTokenBalance(index);
              } catch (error) {
                console.log("error\n");
                console.log({ error });
              }
              mainMenu(rl);
            });
          });
          break;
        case 4:
          rl.question("What account (index) to use?\n", async (index) => {
            await displayTokenBalance(index);
            rl.question("Bet how many times?\n", async (amount) => {
              try {
                await bet(index, amount);
                await displayTokenBalance(index);
              } catch (error) {
                console.log("error\n");
                console.log({ error });
              }
              mainMenu(rl);
            });
          });
          break;
        case 5:
          try {
            await closeLottery();
          } catch (error) {
            console.log("error\n");
            console.log({ error });
          }
          mainMenu(rl);
          break;
        case 6:
          rl.question("What account (index) to use?\n", async (index) => {
            const prize = await displayPrize(index);
            if (Number(prize) > 0) {
              rl.question(
                "Do you want to claim your prize? [Y/N]\n",
                async (answer) => {
                  if (answer.toLowerCase() === "y") {
                    try {
                      await claimPrize(index, prize);
                    } catch (error) {
                      console.log("error\n");
                      console.log({ error });
                    }
                  }
                  mainMenu(rl);
                }
              );
            } else {
              mainMenu(rl);
            }
          });
          break;
        case 7:
          await displayTokenBalance("0");
          await displayOwnerPool();
          rl.question("Withdraw how many tokens?\n", async (amount) => {
            try {
              await withdrawTokens(amount);
            } catch (error) {
              console.log("error\n");
              console.log({ error });
            }
            mainMenu(rl);
          });
          break;
        case 8:
          rl.question("What account (index) to use?\n", async (index) => {
            await displayTokenBalance(index);
            rl.question("Burn how many tokens?\n", async (amount) => {
              try {
                await burnTokens(index, amount);
              } catch (error) {
                console.log("error\n");
                console.log({ error });
              }
              mainMenu(rl);
            });
          });
          break;
        default:
          throw new Error("Invalid option");
      }
    }
  );
}

async function checkState() {
  const betsOpen = await contract.betsOpen();
  console.log(`The bets are ${betsOpen ? "open" : "closed"}`);
  if (!betsOpen) return;
  const closingTimeStamp = await contract.closingTimeStamp();
  const lastBlock = await ethers.provider.getBlock("latest");
  console.log(`The last block timestamp was ${new Date(lastBlock.timestamp * 1000).toLocaleTimeString()} and the lottery is only going to accepts bets until ${new Date(closingTimeStamp.toNumber() * 1000).toLocaleTimeString()}`);
}

async function openBets(duration: string) {
  const lastBlock = await ethers.provider.getBlock("latest");
  const timeStamp = lastBlock.timestamp + parseFloat(duration);
  const tx = await contract.openBets(timeStamp);
  await tx.wait();
}

async function displayBalance(index: string) {
  const balanceBN = await accounts[Number(index)].getBalance();
  console.log(`The account of index ${index} has a balance of ${ethers.utils.formatEther(balanceBN)} ETH`)
}

async function buyTokens(index: string, amount: string) {
  const tx = await contract.connect(accounts[Number(index)]).purchaseTokens({value: ethers.utils.parseEther(amount).div(BET_RATIO)});
  await tx.wait();
}

async function displayTokenBalance(index: string) {
  const tokenBalance = await token.balanceOf(accounts[Number(index)].address);
  console.log(`The account of index ${index} has a balance of ${ethers.utils.formatEther(tokenBalance)} ${SYMBOL}`);
}

async function bet(index: string, amount: string) {
  // const tokenBalanceb4 = await displayTokenBalance(index);
  // console.log('tokenBalanceb4', tokenBalanceb4);
  const approveTx = await token.connect(accounts[Number(index)]).approve(contract.address, ethers.constants.MaxUint256);
  await approveTx.wait();
  const tx = await contract.connect(accounts[Number(index)]).betMany(Number(amount));
  const receipt = await tx.wait();
  console.log(`Bets placed (${receipt.transactionHash})\n`);
  // const tokenBalanceAfter = await displayTokenBalance(index);
  // console.log('tokenBalanceAfter', tokenBalanceAfter);
  }


async function closeLottery() {
  const closeTx = await contract.closeLottery();
  const recepit = await closeTx.wait();
  console.log(`closed lottery with ${recepit.transactionHash}`)
}

async function displayPrize(index: string) {
  const prizeBN = await contract.prize(accounts[Number(index)].address)
  const prize = ethers.utils.formatEther(prizeBN);
  console.log('prizeBN', prizeBN);
  console.log('ethers.utils.formatEther(prizeBN)', prize);
  console.log(`The accounts of address ${accounts[Number(index)]} has earned a prize of ${prize} tokens`)
}

async function claimPrize(index: string, amount: string) {
  console.log('amount', amount);
  console.log('ethers.utils.parseEther(amount)', ethers.utils.parseEther(amount));
  const tx = await contract.connect(accounts[Number(index)]).prizeWithdraw(ethers.utils.parseEther(amount));
  const recepit = await tx.wait();
  console.log(`Prize claimed ${recepit.transactionHash}`)
}

async function displayOwnerPool() {
  const ownerPoolBN = await contract.ownerPool();
  const ownerPool = ethers.utils.formatEther(ownerPoolBN);
  console.log(`Owner pool has ${ownerPool} ${SYMBOL} tokens`)
}

async function withdrawTokens(amount: string) {
  // TODO
}

async function burnTokens(index: string, amount: string) {
  // TODO
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});