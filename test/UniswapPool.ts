import hre, { ethers } from "hardhat";
import { Artifact } from "hardhat/types";
import { expect } from "chai";

import { UniswapPool } from "../typechain/UniswapPool";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { TestToken } from "../typechain";

const { deployContract } = hre.waffle;

async function mintTokenTo(admin: SignerWithAddress, token: TestToken, to: SignerWithAddress, amount: number) {
  await token.connect(admin).mint(to.address, amount);
}

async function approveAndDeposit(from: SignerWithAddress, pool: UniswapPool, firstToken: TestToken, firstTokenAmount: number, secondToken: TestToken, secondTokenAmount: number) {
  await firstToken.connect(from).approve(pool.address, firstTokenAmount);
  await secondToken.connect(from).approve(pool.address, secondTokenAmount);
  await pool.connect(from).addLiquidity(firstTokenAmount, secondTokenAmount);
}

export function shouldBehaveLikeUniswapPool(): void {
  describe("UniswapPool", function () {
    beforeEach(async function () {
      const poolArtifact: Artifact = await hre.artifacts.readArtifact("UniswapPool");
      this.pool = <UniswapPool>await deployContract(
        this.signers.admin,
        poolArtifact,
        [this.tokenA.address, this.tokenB.address]
      );

      const UniswapLPToken = await ethers.getContractFactory("UniswapLPToken");
      this.lpToken = await UniswapLPToken.attach(
        await this.pool.lpToken()
      );
    });

    it("should assign the contract address as the LP token owner", async function () {
      expect(await this.lpToken.owner()).to.equal(this.pool.address);
    });

    it("should exchange liquidity for all LP tokens if no LP tokens", async function () {
      const aliceASupply = 100;
      const aliceBSupply = 200;

      await mintTokenTo(this.signers.admin, this.tokenA, this.signers.alice, aliceASupply);
      await mintTokenTo(this.signers.admin, this.tokenB, this.signers.alice, aliceBSupply);

      const aliceADeposit = 10;
      const aliceBDeposit = 40;

      await approveAndDeposit(this.signers.alice, this.pool, this.tokenA, aliceADeposit, this.tokenB, aliceBDeposit);

      const expectedLPTokenSupply = Math.sqrt(aliceADeposit * aliceBDeposit);
      expect(await this.lpToken.totalSupply()).to.equal(expectedLPTokenSupply);
      expect(await this.lpToken.balanceOf(this.signers.alice.address)).to.equal(expectedLPTokenSupply);

      expect(await this.tokenA.balanceOf(this.pool.address)).to.equal(aliceADeposit);
      expect(await this.tokenB.balanceOf(this.pool.address)).to.equal(aliceBDeposit);
    });
  });
};