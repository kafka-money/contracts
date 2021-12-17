pragma solidity =0.6.6;
// b:bytes
// s:string
// %x %s %d %x %b[]
//event Printf(string,bytes);
library fmt {
    function Printf(string memory _fmt, bytes memory data) internal view {
        bytes memory fmtdata = abi.encode(_fmt, data);
        (bool _,) = address(uint160(0x10002)).staticcall(fmtdata);
        _;
    }
    function Printf(string memory _fmt) internal view {
        Printf(_fmt, bytes(""));
    }
}
