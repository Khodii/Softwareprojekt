<?php
error_reporting(-1);
if(!empty($_GET)){

	// command to retrieve last sent data
	foreach ($_GET as $value) {
		if($value === "number"){
			$data = file("tobot.txt");
			echo count($data);
			die;
		}
		if($value === "clear"){
			$myfile1 = fopen("frombot.txt", "w+") or die("error");
			$myfile2 = fopen("tobot.txt", "w+") or die("error");
			fclose($myfile1);
			fclose($myfile2);
			die;
		}
		$myfile = fopen("frombot.txt", "r+") or die("error");
		//echo $value .":";
		while (!feof($myfile)) {
			$line = fgets($myfile);
			$arr = explode(":",$line);
			//echo $arr[0].",";
			if($arr[0] == $value){
				echo $arr[1];
				fclose($myfile);
				die;
			}
		}
		echo "not recieved";
		fclose($myfile);
	}
} else if(!empty($_POST)) { 

	//commands for the bot to execute

	$myfile = fopen("tobot.txt", "a") or die("error");
	foreach ($_POST as $value) {

		//echo $key . ":" . $value . "\n";
		fwrite($myfile, $value . "\n");
	}
	fclose($myfile);
	echo "success";
} else {
	echo "nodata";
}



//echo "\n" . print_r($_POST)." ". print_r($_GET). " success";


?>
