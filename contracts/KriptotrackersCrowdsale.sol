pragma solidity ^0.5.2;

import "openzeppelin-solidity/contracts/crowdsale/Crowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/emission/MintedCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/validation/CappedCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/validation/TimedCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/distribution/RefundableCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/validation/WhitelistCrowdsale.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Pausable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/TokenTimelock.sol";

interface IMinterRole {
    function renounceMinter() external;
}

contract KriptotrackersCrowdsale is Crowdsale,
	MintedCrowdsale,
	CappedCrowdsale,
	TimedCrowdsale,
	WhitelistCrowdsale,
	RefundableCrowdsale{

	uint256 public investorMinCap =  500000000000000000; //0.5 ether
  	uint256 public investorHardCap = 100000000000000000000; // 100 ether
	mapping(address => uint256) public contributions;

	enum CrowdsaleStage {PreICO,ICO}
	CrowdsaleStage public stage=CrowdsaleStage.PreICO;
	uint256 ico_rate=100;
	uint256 private currentRate;

	//Fixed emission 1M KTS
	uint256 public max_emision=1000000*10**18;
	//Available tokens in the crowdsale
	uint256 public tokenSaleTokens=650000*10**18;
	//Bounties tokens
	uint256 public bountiesTokens=100000*10**18;
	//Fundation tokens
	uint256 public fundationTokens=200000*10**18;
	//Team tokens
	uint256 public teamTokens=50000*10**18;

	uint256 public preICOTokenAmmount=300*10**18;

	address public bountiesFund;
	address public fundationFund;
	address public teamFund;
	address public postICOSaleAddress;
	address payable public  postICOfundAddress;

	uint256 public releaseTime;
	address public foundationTimelock;

	constructor( 
		address payable _wallet, 
		IERC20 _token,
		uint256 _rate,
		uint256 _cap,
		uint256 _openingTime,
		uint256 _closingTime,
		uint256 _goal,
		uint256 _releaseTime,
		address _fundationFund,
		address _bountiesFund,
		address _teamFund) 

		Crowdsale(_rate,_wallet,_token)
		MintedCrowdsale()
		CappedCrowdsale(_cap)
		TimedCrowdsale(_openingTime,_closingTime)
		RefundableCrowdsale(_goal)
		WhitelistCrowdsale()

		public{
			require(_goal<=_cap);
			currentRate=_rate;
			releaseTime=_releaseTime;
			fundationFund=_fundationFund;
			bountiesFund=_bountiesFund;
			teamFund=_teamFund;
			postICOfundAddress=_wallet;
		}

		/**
	 	* @dev Add multiple addresses to the whitelist
	 	* @param _addresses to add to the whitelist
		*/
		function addAddressesToWhitelist(address[] memory _addresses) public onlyWhitelistAdmin{
			for(uint256 i=0;i<_addresses.length;i++){
				addWhitelisted(_addresses[i]);
			}
		}

		/**
  		* @dev Extend parent behavior requiring purchase to respect investor min/max funding cap.
  		* @param _beneficiary Token purchaser
  		* @param _weiAmount Amount of wei contributed
		*/
		function _preValidatePurchase(address _beneficiary, uint256 _weiAmount) internal view
		{
	        super._preValidatePurchase(_beneficiary, _weiAmount);
	        uint256 _existingContributions=contributions[_beneficiary];
	        uint256 _newContribution=_existingContributions.add(_weiAmount);
	        require (_weiAmount>=investorMinCap && _newContribution<=investorHardCap);
	    }

	    /**
	  		* @dev Updates the investor contributions 
	  		* @param _beneficiary Token purchaser
	  		* @param _weiAmount Amount of wei contributed
		*/
	    function _updatePurchasingState(address _beneficiary, uint256 _weiAmount) internal {
	        super._updatePurchasingState(_beneficiary, _weiAmount);
	        contributions[_beneficiary] = contributions[_beneficiary].add(_weiAmount);
	        
	        if(ERC20Mintable(address(token())).totalSupply()>=preICOTokenAmmount){
	        	stage = CrowdsaleStage.ICO;
	        	currentRate=ico_rate;
	        }
	    }

		/**
	     * The base rate function is overridden to revert, since this crowdsale doesn't use it, and
	     * all calls to it are a mistake.
	     */
	    function rate() public view returns (uint256) {
	        revert();
	    }

		/**
	     * @dev Returns the rate of tokens per wei at the current phase
	     * @return The number of tokens a buyer gets per wei at the current phase
	     */
	    function getCurrentRate() public view returns (uint256) {
	        if (!isOpen()) {
	            return 0;
	        }

	        return currentRate;
	    }

	    /**
	     * @dev Overrides parent method taking into account variable rate.
	     * @param weiAmount The value in wei to be converted into tokens
	     * @return The number of tokens _weiAmount wei will buy at present time
	     */
	    function _getTokenAmount(uint256 weiAmount) internal view returns (uint256) {
	        return currentRate.mul(weiAmount);
	    }

		/**
	    * @dev Overrides the finalization method in order to do the following actions:
	    * 
	    * If the goal is reached:
	    *		Enable tokens
	    *		If there are unsold tokens and create a new Simple Crowdsale with 10KTS /1ETH Rate		
	    * 		Mint the  foundation tokens and create a 2 year timelock contract
	    *		Mint the bounties token
	    *		Mint the team tokens
	    *		Renunce minting
	    *
	    * If the goal is not reached just finalize ready to enable refunds 
	    */
	    function _finalization() internal {
        if(goalReached()){
        	//Enable tokens
        	ERC20Pausable(address(token())).unpause();
        	ERC20Mintable _mintableToken=ERC20Mintable(address(token()));

        	//Send remaining tokens for sale 10 per ETH
        	uint256 remainingTokens=tokenSaleTokens.sub(_mintableToken.totalSupply());

        	if(remainingTokens>0){
	        	Crowdsale postICOSale=new Crowdsale(10,postICOfundAddress,token());
	        	postICOSaleAddress=address(postICOSale);
	        	_mintableToken.mint(address(postICOSale),remainingTokens);
        	}

        	//Send fundation fund to 2 years timelock
        	TokenTimelock timelock = new TokenTimelock(token(), fundationFund, releaseTime);
        	_mintableToken.mint(address(timelock),fundationTokens);
        	foundationTimelock=address(timelock);
        	
        	//Generate bounties tokens
        	_mintableToken.mint(bountiesFund,bountiesTokens);
        	//Generate Team tokens
           	_mintableToken.mint(teamFund,teamTokens);

           	//Renunce minting
        	IMinterRole(address(token())).renounceMinter();

        }
        super._finalization();
    }
}