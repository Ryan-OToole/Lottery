// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {LotteryToken} from "./Token.sol";

contract Lottery is Ownable {
    LotteryToken public paymentToken;

    uint256 public closingTimeStamp;
    uint256 public betFee;
    uint256 public betPrice;
    uint256 public purchaseRatio;
    uint256 public randomIndex;

    uint256 public ownerPool;
    uint256 public prizePool;

    mapping(address => uint256) prize;

    address[] _slots;

    bool public betsOpen;

    constructor(
        string memory name,
        string memory symbol,
        uint256 _purchaseRatio,
        uint256 _betPrice,
        uint256 _betFee
    ) {
        betPrice = _betPrice;
        paymentToken = new LotteryToken(name, symbol);
        purchaseRatio = _purchaseRatio;
        betFee = _betFee;
    }

    function openBets(uint256 _closingTimeStamp) external onlyOwner {
        require(!betsOpen, "Bets are already open");
        require(
            _closingTimeStamp > block.timestamp,
            "Closing timestamp needs to be in the future"
        );
        closingTimeStamp = _closingTimeStamp;
        betsOpen = true;
    }

    function purchaseTokens() external payable {
        paymentToken.mint(msg.sender, msg.value * purchaseRatio);
    }

    function bet() public onlyWhenBetsOpen {
        paymentToken.transferFrom(msg.sender, address(this), betPrice + betFee);
        ownerPool += betFee;
        prizePool += betPrice;
        _slots.push(msg.sender);
    }

    function closeLottery() external {
        require(closingTimeStamp <= block.timestamp, "Too soon to close");
        require(betsOpen, "Bets are closed");
        if (_slots.length > 0) {
            randomIndex = getRandomNumber() % _slots.length;
            address winner = _slots[randomIndex];
            prize[winner] += prizePool;
            prizePool = 0;
            delete (_slots);
        }
        betsOpen = false;
    }

    function getRandomNumber() public view returns (uint256 randomNumber) {
        randomNumber = block.difficulty;
    }

    function prizeWithdraw(uint256 amount) public {
        require(
            prize[msg.sender] >= amount,
            "Withdraw amount is greater than your available prize withdrawal"
        );
        prize[msg.sender] -= amount;
        paymentToken.transfer(msg.sender, amount);
    }

    function ownerWithdraw(uint256 amount) public onlyOwner {
        require(
            ownerPool >= amount,
            "You are requesting to withdraw more funds than you have..."
        );
        ownerPool -= amount;
        paymentToken.transfer(msg.sender, amount);
    }

    function returnTokens(uint256 amount) public {
        uint256 returnBalanceToEth = amount / purchaseRatio;
        paymentToken.burnFrom(msg.sender, amount);
        payable(msg.sender).transfer(returnBalanceToEth);
    }

    // Prize withdraw

    // Owner Withdraw

    // return tokens

    modifier onlyWhenBetsOpen() {
        require(betsOpen, "Bets are closed. Sorry");
        require(
            closingTimeStamp > block.timestamp,
            "Betting window has elapsed. Sorry."
        );
        _;
    }
}
