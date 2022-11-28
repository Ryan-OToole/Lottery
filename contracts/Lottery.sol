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
        closingTimeStamp = _closingTimeStamp;
        betsOpen = true;
    }
}
